import {
  pgTable,
  bigint,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// system_notification
// ---------------------------------------------------------------------------
export const systemNotification = pgTable('system_notification', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  receiverId: bigint('receiver_id', { mode: 'number' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  readFlag: boolean('read_flag').default(false).notNull(),
  eventType: varchar('event_type', { length: 64 }),
  refType: varchar('ref_type', { length: 64 }),
  refId: bigint('ref_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SystemNotificationRow = typeof systemNotification.$inferSelect;
export type NewSystemNotification = typeof systemNotification.$inferInsert;

// ---------------------------------------------------------------------------
// field_change_log
// ---------------------------------------------------------------------------
export const fieldChangeLog = pgTable('field_change_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  bizType: varchar('biz_type', { length: 64 }).notNull(),
  bizId: bigint('biz_id', { mode: 'number' }).notNull(),
  fieldName: varchar('field_name', { length: 128 }).notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  operatorId: bigint('operator_id', { mode: 'number' }).notNull(),
  operatedAt: timestamp('operated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type FieldChangeLogRow = typeof fieldChangeLog.$inferSelect;
export type NewFieldChangeLog = typeof fieldChangeLog.$inferInsert;

// ---------------------------------------------------------------------------
// admin_audit_log
// ---------------------------------------------------------------------------
export const adminAuditLog = pgTable('admin_audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  operatorId: bigint('operator_id', { mode: 'number' }).notNull(),
  actionType: varchar('action_type', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 64 }).notNull(),
  targetId: varchar('target_id', { length: 128 }).notNull(),
  detail: jsonb('detail'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AdminAuditLogRow = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;

// ---------------------------------------------------------------------------
// file_attachment
// ---------------------------------------------------------------------------
export const fileAttachment = pgTable('file_attachment', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  bizType: varchar('biz_type', { length: 64 }).notNull(),
  bizId: bigint('biz_id', { mode: 'number' }).notNull(),
  nodeKey: varchar('node_key', { length: 64 }),
  slotKey: varchar('slot_key', { length: 64 }),
  fileName: varchar('file_name', { length: 256 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).default(0).notNull(),
  contentType: varchar('content_type', { length: 128 }),
  storagePath: varchar('storage_path', { length: 512 }).notNull(),
  checksumSha256: varchar('checksum_sha256', { length: 64 }),
  uploaderId: bigint('uploader_id', { mode: 'number' }).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type FileAttachmentRow = typeof fileAttachment.$inferSelect;
export type NewFileAttachment = typeof fileAttachment.$inferInsert;

// ---------------------------------------------------------------------------
// recycle_bin
// ---------------------------------------------------------------------------
export const recycleBin = pgTable('recycle_bin', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  bizType: varchar('biz_type', { length: 32 }).notNull(),
  bizId: bigint('biz_id', { mode: 'number' }).notNull(),
  displayName: varchar('display_name', { length: 500 }),
  snapshotJson: jsonb('snapshot_json'),
  deletedBy: bigint('deleted_by', { mode: 'number' }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 255 }),
});

export type RecycleBinRow = typeof recycleBin.$inferSelect;
export type NewRecycleBin = typeof recycleBin.$inferInsert;
