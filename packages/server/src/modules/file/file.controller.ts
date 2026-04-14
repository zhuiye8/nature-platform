import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileService } from './file.service';
import type { Response } from 'express';

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
      throw new BadRequestException('请选择要上传的文件');
    }
    if (!bizType) {
      throw new BadRequestException('缺少文件类型参数');
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
    @Query('mode') mode: string | undefined,
    @Res() res: Response,
    @CurrentUser() user: { id: number; displayName?: string; username?: string },
  ) {
    if (mode === 'preview') {
      // Preview: buffer → watermark (images/PDFs) → send with inline disposition
      const { buffer, fileName, contentType } =
        await this.fileService.streamFilePreview(id, {
          displayName: user?.displayName,
          username: user?.username,
        });
      const encodedName = encodeURIComponent(fileName);
      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      });
      res.send(buffer);
      return;
    }

    // Download: raw stream, no watermark
    const { stream, fileName, contentType } = await this.fileService.streamFile(id);
    const encodedName = encodeURIComponent(fileName);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    });
    stream.pipe(res);
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
