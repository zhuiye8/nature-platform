import {
  pgTable,
  bigint,
  varchar,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const userAccount = pgTable('user_account', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  username: varchar('username', { length: 64 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  mustChangePwd: boolean('must_change_pwd').default(false).notNull(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  mobile: varchar('mobile', { length: 32 }),
  email: varchar('email', { length: 128 }),
  enabled: boolean('enabled').default(true).notNull(),
  sourceType: varchar('source_type', { length: 16 }).default('LOCAL').notNull(),
  deptId: bigint('dept_id', { mode: 'number' }),
  dingUserId: varchar('ding_user_id', { length: 64 }),
  dingUnionId: varchar('ding_union_id', { length: 128 }),
  dingJobNumber: varchar('ding_job_number', { length: 64 }),
  certificateNo: varchar('certificate_no', { length: 64 }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserAccountRow = typeof userAccount.$inferSelect;
export type NewUserAccount = typeof userAccount.$inferInsert;
