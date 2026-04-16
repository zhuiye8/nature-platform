import {
  pgTable,
  bigint,
  varchar,
  integer,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// wf_definition
// ---------------------------------------------------------------------------
export const wfDefinition = pgTable('wf_definition', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  defKey: varchar('def_key', { length: 64 }).notNull(),
  version: integer('version').notNull().default(1),
  defName: varchar('def_name', { length: 128 }).notNull(),
  description: varchar('description', { length: 500 }),
  status: varchar('status', { length: 16 }).notNull().default('DRAFT'),
  createdBy: bigint('created_by', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WfDefinitionRow = typeof wfDefinition.$inferSelect;
export type NewWfDefinition = typeof wfDefinition.$inferInsert;

// ---------------------------------------------------------------------------
// wf_node
// ---------------------------------------------------------------------------
export const wfNode = pgTable('wf_node', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  definitionId: bigint('definition_id', { mode: 'number' }).notNull(),
  nodeKey: varchar('node_key', { length: 64 }).notNull(),
  nodeName: varchar('node_name', { length: 128 }).notNull(),
  nodeType: varchar('node_type', { length: 32 }).notNull(),
  nodeOrder: integer('node_order').notNull().default(0),
  config: jsonb('config'),
});

export type WfNodeRow = typeof wfNode.$inferSelect;
export type NewWfNode = typeof wfNode.$inferInsert;

// ---------------------------------------------------------------------------
// wf_transition
// ---------------------------------------------------------------------------
export const wfTransition = pgTable('wf_transition', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  definitionId: bigint('definition_id', { mode: 'number' }).notNull(),
  fromNodeKey: varchar('from_node_key', { length: 64 }).notNull().default(''),
  toNodeKey: varchar('to_node_key', { length: 64 }).notNull().default(''),
  event: varchar('event', { length: 64 }).notNull(),
  guardExpr: varchar('guard_expr', { length: 500 }),
  priority: integer('priority').notNull().default(0),
});

export type WfTransitionRow = typeof wfTransition.$inferSelect;
export type NewWfTransition = typeof wfTransition.$inferInsert;

// ---------------------------------------------------------------------------
// wf_instance
// ---------------------------------------------------------------------------
export const wfInstance = pgTable('wf_instance', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  definitionId: bigint('definition_id', { mode: 'number' }).notNull(),
  bizType: varchar('biz_type', { length: 64 }).notNull(),
  bizId: bigint('biz_id', { mode: 'number' }).notNull(),
  currentNode: varchar('current_node', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('RUNNING'),
  roundNo: integer('round_no').notNull().default(1),
  startedBy: bigint('started_by', { mode: 'number' }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  variables: jsonb('variables'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WfInstanceRow = typeof wfInstance.$inferSelect;
export type NewWfInstance = typeof wfInstance.$inferInsert;

// ---------------------------------------------------------------------------
// wf_task
// ---------------------------------------------------------------------------
export const wfTask = pgTable('wf_task', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  instanceId: bigint('instance_id', { mode: 'number' }).notNull(),
  nodeKey: varchar('node_key', { length: 64 }).notNull(),
  slotKey: varchar('slot_key', { length: 64 }),
  assigneeId: bigint('assignee_id', { mode: 'number' }),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'),
  result: varchar('result', { length: 32 }),
  remark: varchar('remark', { length: 1000 }),
  formData: jsonb('form_data'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WfTaskRow = typeof wfTask.$inferSelect;
export type NewWfTask = typeof wfTask.$inferInsert;

// ---------------------------------------------------------------------------
// wf_assignment_rule
// ---------------------------------------------------------------------------
export const wfAssignmentRule = pgTable(
  'wf_assignment_rule',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    nodeKey: varchar('node_key', { length: 64 }).notNull(),
    slotKey: varchar('slot_key', { length: 64 }).notNull(),
    slotLabel: varchar('slot_label', { length: 128 }).notNull(),
    roleCode: varchar('role_code', { length: 64 }).notNull(),
    avoidanceRule: varchar('avoidance_rule', { length: 32 })
      .notNull()
      .default('NONE'),
    priority: integer('priority').notNull().default(0),
  },
  (t) => [
    unique('wf_assignment_rule_node_slot_role_uq').on(
      t.nodeKey,
      t.slotKey,
      t.roleCode,
    ),
  ],
);

export type WfAssignmentRuleRow = typeof wfAssignmentRule.$inferSelect;
export type NewWfAssignmentRule = typeof wfAssignmentRule.$inferInsert;

// ---------------------------------------------------------------------------
// wf_action_log
// ---------------------------------------------------------------------------
export const wfActionLog = pgTable('wf_action_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  instanceId: bigint('instance_id', { mode: 'number' }).notNull(),
  taskId: bigint('task_id', { mode: 'number' }),
  nodeKey: varchar('node_key', { length: 64 }).notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  fromNode: varchar('from_node', { length: 64 }),
  toNode: varchar('to_node', { length: 64 }),
  operatorId: bigint('operator_id', { mode: 'number' }).notNull(),
  remark: varchar('remark', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WfActionLogRow = typeof wfActionLog.$inferSelect;
export type NewWfActionLog = typeof wfActionLog.$inferInsert;
