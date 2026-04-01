import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { compileReportFile } from '../../database/schema/assessment-file';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import * as crypto from 'crypto';

const BUCKET_NAME = 'nature-files';

@Injectable()
export class CompileFileService implements OnModuleInit {
  private readonly logger = new Logger(CompileFileService.name);
  private s3: S3Client;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {
    let endpoint = this.configService.get('MINIO_ENDPOINT', 'http://localhost:9010');
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
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      } catch (e) {
        this.logger.warn(`Failed to create bucket: ${e}`);
      }
    }
  }

  async upload(
    projectRegisterId: number,
    file: Express.Multer.File,
    remark: string | null,
    userId: number,
  ) {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
    const ext = originalName.split('.').pop() || 'bin';
    const uuid = crypto.randomUUID();
    const storagePath = `compile-report/${projectRegisterId}/${uuid}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storagePath,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    const [row] = await this.db
      .insert(compileReportFile)
      .values({
        projectRegisterId,
        fileName: originalName,
        objectKey: storagePath,
        fileSize: file.size,
        contentType: file.mimetype,
        remark: remark ?? null,
        compiledBy: userId,
      })
      .returning();

    return row;
  }

  async findByProject(projectRegisterId: number) {
    return this.db
      .select({
        id: compileReportFile.id,
        projectRegisterId: compileReportFile.projectRegisterId,
        fileName: compileReportFile.fileName,
        fileSize: compileReportFile.fileSize,
        contentType: compileReportFile.contentType,
        remark: compileReportFile.remark,
        compiledBy: compileReportFile.compiledBy,
        compilerName: userAccount.displayName,
        uploadedAt: compileReportFile.uploadedAt,
      })
      .from(compileReportFile)
      .leftJoin(userAccount, eq(compileReportFile.compiledBy, userAccount.id))
      .where(
        and(
          eq(compileReportFile.projectRegisterId, projectRegisterId),
          isNull(compileReportFile.deletedAt),
        ),
      )
      .orderBy(desc(compileReportFile.uploadedAt));
  }

  async getDownloadUrl(fileId: number) {
    const rows = await this.db
      .select()
      .from(compileReportFile)
      .where(and(eq(compileReportFile.id, fileId), isNull(compileReportFile.deletedAt)))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('File not found');

    const file = rows[0];
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.objectKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 1800 });
    return { url, fileName: file.fileName };
  }

  async remove(fileId: number, userId: number) {
    const rows = await this.db
      .select()
      .from(compileReportFile)
      .where(and(eq(compileReportFile.id, fileId), isNull(compileReportFile.deletedAt)))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('File not found');

    if (rows[0].compiledBy !== userId) {
      const adminCheck = await this.db
        .select()
        .from(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.roleCode, 'super_admin')))
        .limit(1);
      if (adminCheck.length === 0) {
        throw new ForbiddenException('仅上传人或管理员可删除');
      }
    }

    await this.db
      .update(compileReportFile)
      .set({ deletedAt: new Date() })
      .where(eq(compileReportFile.id, fileId));

    return { success: true };
  }
}
