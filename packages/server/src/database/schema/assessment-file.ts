import {
  pgTable,
  bigint,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// assessment_file — 测评文件池（含测评文件和测评成果）
// ---------------------------------------------------------------------------
export const assessmentFile = pgTable('assessment_file', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
  filePool: varchar('file_pool', { length: 32 }).notNull(), // ASSESSMENT_FILE | ASSESSMENT_RESULT
  fileName: varchar('file_name', { length: 500 }).notNull(),
  objectKey: varchar('object_key', { length: 512 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).default(0).notNull(),
  contentType: varchar('content_type', { length: 128 }),
  remark: varchar('remark', { length: 500 }),
  uploadedBy: bigint('uploaded_by', { mode: 'number' }).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type AssessmentFileRow = typeof assessmentFile.$inferSelect;
export type NewAssessmentFile = typeof assessmentFile.$inferInsert;

// ---------------------------------------------------------------------------
// compile_report_file — 编制报告文件池
// ---------------------------------------------------------------------------
export const compileReportFile = pgTable('compile_report_file', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  objectKey: varchar('object_key', { length: 512 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).default(0).notNull(),
  contentType: varchar('content_type', { length: 128 }),
  remark: varchar('remark', { length: 500 }),
  compiledBy: bigint('compiled_by', { mode: 'number' }).notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type CompileReportFileRow = typeof compileReportFile.$inferSelect;
export type NewCompileReportFile = typeof compileReportFile.$inferInsert;
