import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { RecycleModule } from '../recycle/recycle.module';

@Module({
  imports: [RecycleModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
