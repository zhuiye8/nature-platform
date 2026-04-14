import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { fileAttachment } from '../../database/schema/common';
import { userAccount } from '../../database/schema/user';
import * as crypto from 'crypto';

const BUCKET_NAME = 'nature-files';

@Injectable()
export class FileService implements OnModuleInit {
  private readonly logger = new Logger(FileService.name);
  private s3: S3Client;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    let endpoint = this.configService.get('MINIO_ENDPOINT', 'http://localhost:9010');
    // Ensure endpoint has protocol prefix
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      const port = this.configService.get('MINIO_PORT', '9010');
      endpoint = `http://${endpoint}:${port}`;
    }
    this.s3 = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin123'),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      this.logger.log(`Bucket "${BUCKET_NAME}" exists`);
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        this.logger.log(`Bucket "${BUCKET_NAME}" created`);
      } catch (e) {
        this.logger.warn(`Failed to create bucket: ${e}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Upload
  // -----------------------------------------------------------------------
  async upload(
    file: Express.Multer.File,
    bizType: string,
    bizId: number,
    userId: number,
    nodeKey?: string,
  ) {
    // Fix: multer encodes originalname as latin1, decode to UTF-8
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
    const ext = originalName.split('.').pop() || 'bin';
    const uuid = crypto.randomUUID();
    const storagePath = `${bizType.toLowerCase()}/${bizId}/${uuid}.${ext}`;

    // If nodeKey provided, soft-delete old files with same bizType+bizId+nodeKey (replace mode)
    if (nodeKey) {
      await this.db
        .update(fileAttachment)
        .set({ deleted: true, deletedAt: new Date() })
        .where(
          and(
            eq(fileAttachment.bizType, bizType),
            eq(fileAttachment.bizId, bizId),
            eq(fileAttachment.nodeKey, nodeKey),
            eq(fileAttachment.deleted, false),
          ),
        );
    }

    // Upload to MinIO
    await this.s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storagePath,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    // Compute checksum
    const checksum = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Save metadata
    const rows = await this.db
      .insert(fileAttachment)
      .values({
        bizType,
        bizId,
        nodeKey: nodeKey || null,
        fileName: originalName,
        fileSize: file.size,
        contentType: file.mimetype,
        storagePath,
        checksumSha256: checksum,
        uploaderId: userId,
      })
      .returning();

    this.eventEmitter.emit('file.uploaded', {
      bizType,
      bizId,
      uploaderId: userId,
      fileId: rows[0].id,
    });

    return rows[0];
  }

  // -----------------------------------------------------------------------
  // List by business entity
  // -----------------------------------------------------------------------
  async getByBiz(bizType: string, bizId: number) {
    const rows = await this.db
      .select({
        id: fileAttachment.id,
        fileName: fileAttachment.fileName,
        fileSize: fileAttachment.fileSize,
        contentType: fileAttachment.contentType,
        nodeKey: fileAttachment.nodeKey,
        uploaderId: fileAttachment.uploaderId,
        uploaderName: userAccount.displayName,
        uploadedAt: fileAttachment.uploadedAt,
      })
      .from(fileAttachment)
      .leftJoin(userAccount, eq(fileAttachment.uploaderId, userAccount.id))
      .where(
        and(
          eq(fileAttachment.bizType, bizType),
          eq(fileAttachment.bizId, bizId),
          eq(fileAttachment.deleted, false),
        ),
      )
      .orderBy(desc(fileAttachment.uploadedAt));

    return rows;
  }

  // -----------------------------------------------------------------------
  // Stream file from S3 (proxy download) — no modification
  // -----------------------------------------------------------------------
  async streamFile(id: number) {
    const rows = await this.db
      .select()
      .from(fileAttachment)
      .where(and(eq(fileAttachment.id, id), eq(fileAttachment.deleted, false)))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('文件不存在');
    }

    const file = rows[0];
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.storagePath,
    });

    const response = await this.s3.send(command);
    return {
      stream: response.Body as import('stream').Readable,
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.fileSize,
    };
  }

  // -----------------------------------------------------------------------
  // Stream file for preview — applies watermark for images / PDFs.
  // Returns a Buffer (not a stream) because watermarking needs the full
  // content in memory. Other formats pass through unmodified.
  // -----------------------------------------------------------------------
  async streamFilePreview(
    id: number,
    viewer: { displayName?: string | null; username?: string | null },
  ) {
    const rows = await this.db
      .select()
      .from(fileAttachment)
      .where(and(eq(fileAttachment.id, id), eq(fileAttachment.deleted, false)))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('文件不存在');
    }

    const file = rows[0];
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.storagePath,
    });
    const response = await this.s3.send(command);

    // Read entire body into a buffer
    const body = response.Body as import('stream').Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const name = viewer.displayName ?? viewer.username ?? '用户';
    const username = viewer.username ?? '';
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const watermarkText = `${name}${username ? `(${username})` : ''} ${ts}`;

    const contentType = file.contentType || '';
    try {
      if (contentType.startsWith('image/')) {
        const processed = await this.applyImageWatermark(buffer, watermarkText);
        return {
          buffer: processed,
          fileName: file.fileName,
          contentType,
        };
      }
      if (contentType === 'application/pdf') {
        const processed = await this.applyPdfWatermark(buffer, watermarkText);
        return {
          buffer: processed,
          fileName: file.fileName,
          contentType,
        };
      }
    } catch (e) {
      this.logger.warn(`Watermark failed for file #${id}: ${(e as Error).message}`);
    }

    // Unsupported type or watermark failed → return raw
    return {
      buffer,
      fileName: file.fileName,
      contentType,
    };
  }

  /**
   * Overlay a tiled, rotated watermark text on a raster image using sharp.
   */
  private async applyImageWatermark(
    input: Buffer,
    text: string,
  ): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    const img = sharp(input);
    const meta = await img.metadata();
    const width = meta.width ?? 800;
    const height = meta.height ?? 600;

    // Build a repeating SVG pattern across the whole image
    const safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const tileW = 360;
    const tileH = 200;
    const cols = Math.ceil(width / tileW) + 1;
    const rows = Math.ceil(height / tileH) + 1;
    const labels: string[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileW + (r % 2 === 0 ? 0 : tileW / 2);
        const y = r * tileH + tileH / 2;
        labels.push(
          `<text x="${x}" y="${y}" fill="rgba(0,0,0,0.12)" font-size="18" font-family="sans-serif" transform="rotate(-22 ${x} ${y})">${safeText}</text>`,
        );
      }
    }
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`;

    return img
      .composite([{ input: Buffer.from(svg), blend: 'over' }])
      .toBuffer();
  }

  /**
   * Overlay a tiled watermark on every page of a PDF using pdf-lib.
   */
  private async applyPdfWatermark(
    input: Buffer,
    text: string,
  ): Promise<Buffer> {
    const { PDFDocument, StandardFonts, degrees, rgb } = await import(
      'pdf-lib'
    );
    const pdfDoc = await PDFDocument.load(input);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Strip non-Latin chars because StandardFonts don't support Chinese.
    // Render the username + timestamp; Chinese display name is replaced
    // with a placeholder to keep PDFs valid.
    const latinOnly = text.replace(/[^\x20-\x7E]/g, '*');

    const pages = pdfDoc.getPages();
    const fontSize = 14;
    const step = 220; // horizontal/vertical spacing between watermarks

    for (const page of pages) {
      const { width, height } = page.getSize();
      for (let y = step / 2; y < height + step; y += step) {
        for (let x = -step; x < width + step; x += step) {
          page.drawText(latinOnly, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0.1,
            rotate: degrees(-22),
          });
        }
      }
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  // -----------------------------------------------------------------------
  // Soft delete
  // -----------------------------------------------------------------------
  async remove(id: number, userId: number, isSuperAdmin: boolean) {
    const rows = await this.db
      .select()
      .from(fileAttachment)
      .where(and(eq(fileAttachment.id, id), eq(fileAttachment.deleted, false)))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('文件不存在');
    }

    const file = rows[0];
    if (file.uploaderId !== userId && !isSuperAdmin) {
      throw new ForbiddenException('只有上传者或管理员可以删除此文件');
    }

    await this.db
      .update(fileAttachment)
      .set({ deleted: true, deletedAt: new Date() })
      .where(eq(fileAttachment.id, id));

    return { success: true };
  }

  async removeByBiz(bizType: string, bizId: number, nodeKey: string, userId: number) {
    await this.db
      .update(fileAttachment)
      .set({ deleted: true, deletedAt: new Date() })
      .where(
        and(
          eq(fileAttachment.bizType, bizType),
          eq(fileAttachment.bizId, bizId),
          eq(fileAttachment.nodeKey, nodeKey),
          eq(fileAttachment.deleted, false),
        ),
      );
    return { success: true };
  }
}
