import { Module } from '@nestjs/common';
import { CompileFileController } from './compile-file.controller';
import { CompileFileService } from './compile-file.service';

@Module({
  controllers: [CompileFileController],
  providers: [CompileFileService],
  exports: [CompileFileService],
})
export class CompileFileModule {}
