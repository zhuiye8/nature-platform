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
import { CompileFileService } from './compile-file.service';

@Controller('compile-file')
@UseGuards(JwtAuthGuard)
export class CompileFileController {
  constructor(private readonly service: CompileFileService) {}

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
  ) {
    return this.service.findByProject(projectRegisterId);
  }

  @Post(':projectRegisterId')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }),
  )
  async upload(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
    @UploadedFile() file: Express.Multer.File,
    @Query('remark') remark: string | undefined,
    @CurrentUser() user: { id: number },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.service.upload(projectRegisterId, file, remark ?? null, user.id);
  }
}
