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
  // Stream file from S3 (proxy download)
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
