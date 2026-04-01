import {
  pgTable,
  bigint,
  varchar,
  boolean,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// iam_resource
// ---------------------------------------------------------------------------
export const iamResource = pgTable('iam_resource', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  resourceKey: varchar('resource_key', { length: 128 }).unique().notNull(),
  resourceName: varchar('resource_name', { length: 128 }).notNull(),
  resourceType: varchar('resource_type', { length: 16 }).notNull(),
  parentKey: varchar('parent_key', { length: 128 }),
  routePath: varchar('route_path', { length: 255 }),
  icon: varchar('icon', { length: 64 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  builtIn: boolean('built_in').default(true).notNull(),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type IamResourceRow = typeof iamResource.$inferSelect;
export type NewIamResource = typeof iamResource.$inferInsert;

// ---------------------------------------------------------------------------
// iam_role_resource
// ---------------------------------------------------------------------------
export const iamRoleResource = pgTable('iam_role_resource', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  roleCode: varchar('role_code', { length: 64 }).notNull(),
  resourceKey: varchar('resource_key', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type IamRoleResourceRow = typeof iamRoleResource.$inferSelect;
export type NewIamRoleResource = typeof iamRoleResource.$inferInsert;
