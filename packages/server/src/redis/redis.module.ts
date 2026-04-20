import { Global, Module, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') || 'redis://localhost:6389';
        const logger = new Logger('Redis');
        const client = new Redis(url, {
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        });
        client.on('connect', () => logger.log(`Connected to ${url}`));
        client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  async onModuleDestroy() {
    // Clients auto-cleanup on process exit; no explicit close needed
  }
}
