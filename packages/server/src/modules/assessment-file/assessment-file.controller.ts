import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssessmentFileService } from './assessment-file.service';

@Controller('assessment-file')
@UseGuards(JwtAuthGuard)
export class AssessmentFileController {
  constructor(private readonly service: AssessmentFileService) {}

  @Get('download/:fileId')
  async download(@Param('fileId', ParseIntPipe) fileId: number) {
    return this.service.getDownloadUrl(fileId);
  }

  @Delete('remove/:fileId')
  async remove(
    @Param('fileId', ParseIntPipe) fileId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.remove(fileId, user.id);
  }

  @Get(':projectRegisterId')
  async list(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
    @Query('pool') pool?: string,
  ) {
    return this.service.findByProject(projectRegisterId, pool);
  }

  @Post(':projectRegisterId')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }),
  )
  async upload(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
    @UploadedFile() file: Express.Multer.File,
    @Query('pool') pool: string,
    @Query('remark') remark: string | undefined,
    @CurrentUser() user: { id: number },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!pool) throw new BadRequestException('pool is required (ASSESSMENT_FILE or ASSESSMENT_RESULT)');
    return this.service.upload(projectRegisterId, pool, file, remark ?? null, user.id);
  }
}
