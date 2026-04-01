import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): DrizzleDB => {
        const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
        const client = postgres(databaseUrl);
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
