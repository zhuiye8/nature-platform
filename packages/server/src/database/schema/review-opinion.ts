import {
  pgTable,
  bigint,
  varchar,
  integer,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// review_opinion — 审核意见历史
// ---------------------------------------------------------------------------
export const reviewOpinion = pgTable('review_opinion', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
  roundNo: integer('round_no').notNull().default(1),
  nodeKey: varchar('node_key', { length: 64 }).notNull(),
  slotKey: varchar('slot_key', { length: 64 }),
  actionType: varchar('action_type', { length: 32 }).notNull(),
  opinionText: text('opinion_text'),
  attachmentIds: jsonb('attachment_ids'),
  operatorId: bigint('operator_id', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ReviewOpinionRow = typeof reviewOpinion.$inferSelect;
export type NewReviewOpinion = typeof reviewOpinion.$inferInsert;

// ---------------------------------------------------------------------------
// review_opinion_template — 意见模板
// ---------------------------------------------------------------------------
export const reviewOpinionTemplate = pgTable('review_opinion_template', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  nodeKey: varchar('node_key', { length: 64 }).notNull(),
  slotKey: varchar('slot_key', { length: 64 }),
  actionType: varchar('action_type', { length: 32 }).notNull(),
  templateText: text('template_text').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type ReviewOpinionTemplateRow = typeof reviewOpinionTemplate.$inferSelect;
export type NewReviewOpinionTemplate = typeof reviewOpinionTemplate.$inferInsert;
