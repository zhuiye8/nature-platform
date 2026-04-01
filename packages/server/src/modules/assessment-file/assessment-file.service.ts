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
import { assessmentFile } from '../../database/schema/assessment-file';
import { projectMember } from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import * as crypto from 'crypto';

const BUCKET_NAME = 'nature-files';

@Injectable()
export class AssessmentFileService implements OnModuleInit {
  private readonly logger = new Logger(AssessmentFileService.name);
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

  // -----------------------------------------------------------------------
  // Upload
  // -----------------------------------------------------------------------
  async upload(
    projectRegisterId: number,
    filePool: string,
    file: Express.Multer.File,
    remark: string | null,
    userId: number,
  ) {
    // Permission check: ASSESSMENT_RESULT requires PM role
    if (filePool === 'ASSESSMENT_RESULT') {
      const pmCheck = await this.db
        .select()
        .from(projectMember)
        .where(
          and(
            eq(projectMember.projectId, projectRegisterId),
            eq(projectMember.userId, userId),
            eq(projectMember.roleType, 'PM'),
            eq(projectMember.status, 'ACTIVE'),
          ),
        )
        .limit(1);

      if (pmCheck.length === 0) {
        // Also allow super_admin
        const adminCheck = await this.db
          .select()
          .from(userRole)
          .where(and(eq(userRole.userId, userId), eq(userRole.roleCode, 'super_admin')))
          .limit(1);
        if (adminCheck.length === 0) {
          throw new ForbiddenException('仅项目经理可上传测评成果');
        }
      }
    }

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
    const ext = originalName.split('.').pop() || 'bin';
    const uuid = crypto.randomUUID();
    const storagePath = `assessment/${projectRegisterId}/${filePool.toLowerCase()}/${uuid}.${ext}`;

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
      .insert(assessmentFile)
      .values({
        projectRegisterId,
        filePool,
        fileName: originalName,
        objectKey: storagePath,
        fileSize: file.size,
        contentType: file.mimetype,
        remark: remark ?? null,
        uploadedBy: userId,
      })
      .returning();

    return row;
  }

  // -----------------------------------------------------------------------
  // List
  // -----------------------------------------------------------------------
  async findByProject(projectRegisterId: number, filePool?: string) {
    const conditions = [
      eq(assessmentFile.projectRegisterId, projectRegisterId),
      isNull(assessmentFile.deletedAt),
    ];
    if (filePool) {
      conditions.push(eq(assessmentFile.filePool, filePool));
    }

    return this.db
      .select({
        id: assessmentFile.id,
        projectRegisterId: assessmentFile.projectRegisterId,
        filePool: assessmentFile.filePool,
        fileName: assessmentFile.fileName,
        fileSize: assessmentFile.fileSize,
        contentType: assessmentFile.contentType,
        remark: assessmentFile.remark,
        uploadedBy: assessmentFile.uploadedBy,
        uploaderName: userAccount.displayName,
        uploadedAt: assessmentFile.uploadedAt,
      })
      .from(assessmentFile)
      .leftJoin(userAccount, eq(assessmentFile.uploadedBy, userAccount.id))
      .where(and(...conditions))
      .orderBy(desc(assessmentFile.uploadedAt));
  }

  // -----------------------------------------------------------------------
  // Download (presigned URL)
  // -----------------------------------------------------------------------
  async getDownloadUrl(fileId: number) {
    const rows = await this.db
      .select()
      .from(assessmentFile)
      .where(and(eq(assessmentFile.id, fileId), isNull(assessmentFile.deletedAt)))
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

  // -----------------------------------------------------------------------
  // Soft delete
  // -----------------------------------------------------------------------
  async remove(fileId: number, userId: number) {
    const rows = await this.db
      .select()
      .from(assessmentFile)
      .where(and(eq(assessmentFile.id, fileId), isNull(assessmentFile.deletedAt)))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('File not found');

    const file = rows[0];
    if (file.uploadedBy !== userId) {
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
      .update(assessmentFile)
      .set({ deletedAt: new Date() })
      .where(eq(assessmentFile.id, fileId));

    return { success: true };
  }
}
