import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileService } from './file.service';

@Controller('file')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('bizType') bizType: string,
    @Query('bizId', ParseIntPipe) bizId: number,
    @Query('nodeKey') nodeKey: string | undefined,
    @CurrentUser() user: { id: number },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!bizType) {
      throw new BadRequestException('bizType is required');
    }
    return this.fileService.upload(file, bizType, bizId, user.id, nodeKey);
  }

  @Get('list')
  async list(
    @Query('bizType') bizType: string,
    @Query('bizId', ParseIntPipe) bizId: number,
  ) {
    return this.fileService.getByBiz(bizType, bizId);
  }

  @Get('download/:id')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Query('mode') mode?: string,
  ) {
    return this.fileService.getPresignedUrl(id, mode === 'preview' ? 'preview' : 'download');
  }

  @Delete('by-biz')
  async removeByBiz(
    @Query('bizType') bizType: string,
    @Query('bizId', ParseIntPipe) bizId: number,
    @Query('nodeKey') nodeKey: string,
    @CurrentUser() user: { id: number },
  ) {
    return this.fileService.removeByBiz(bizType, bizId, nodeKey, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; permissions: string[] },
  ) {
    const isSuperAdmin =
      user.permissions?.includes('*:*') || false;
    return this.fileService.remove(id, user.id, isSuperAdmin);
  }
}
