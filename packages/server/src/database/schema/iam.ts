import {
  pgTable,
  bigint,
  varchar,
  boolean,
  timestamp,
  integer,
  unique,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// iam_department
// ---------------------------------------------------------------------------
export const iamDepartment = pgTable('iam_department', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  deptCode: varchar('dept_code', { length: 64 }).unique().notNull(),
  deptName: varchar('dept_name', { length: 128 }).notNull(),
  parentId: bigint('parent_id', { mode: 'number' }),
  sourceType: varchar('source_type', { length: 16 }).default('LOCAL').notNull(),
  dingDeptId: varchar('ding_dept_id', { length: 64 }),
  defaultRoleCode: varchar('default_role_code', { length: 64 }),
  enabled: boolean('enabled').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type IamDepartmentRow = typeof iamDepartment.$inferSelect;
export type NewIamDepartment = typeof iamDepartment.$inferInsert;

// ---------------------------------------------------------------------------
// iam_role
// ---------------------------------------------------------------------------
export const iamRole = pgTable('iam_role', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  roleCode: varchar('role_code', { length: 64 }).unique().notNull(),
  roleName: varchar('role_name', { length: 128 }).notNull(),
  description: varchar('description', { length: 500 }),
  systemFlag: boolean('system_flag').default(false).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type IamRoleRow = typeof iamRole.$inferSelect;
export type NewIamRole = typeof iamRole.$inferInsert;

// ---------------------------------------------------------------------------
// user_role
// ---------------------------------------------------------------------------
export const userRole = pgTable(
  'user_role',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    roleCode: varchar('role_code', { length: 64 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // 防止 seed 重复跑时累积重复绑定（ON CONFLICT DO NOTHING 依赖此约束）
    uniqUserRole: unique('user_role_user_id_role_code_unique').on(
      table.userId,
      table.roleCode,
    ),
  }),
);

export type UserRoleRow = typeof userRole.$inferSelect;
export type NewUserRole = typeof userRole.$inferInsert;

// ---------------------------------------------------------------------------
// iam_permission
// ---------------------------------------------------------------------------
export const iamPermission = pgTable('iam_permission', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  permissionCode: varchar('permission_code', { length: 128 }).unique().notNull(),
  permissionName: varchar('permission_name', { length: 128 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  description: varchar('description', { length: 500 }),
  enabled: boolean('enabled').default(true).notNull(),
  builtIn: boolean('built_in').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type IamPermissionRow = typeof iamPermission.$inferSelect;
export type NewIamPermission = typeof iamPermission.$inferInsert;

// ---------------------------------------------------------------------------
// iam_role_permission
// ---------------------------------------------------------------------------
export const iamRolePermission = pgTable(
  'iam_role_permission',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    roleCode: varchar('role_code', { length: 64 }).notNull(),
    permissionCode: varchar('permission_code', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // 防止 seed 重复跑时累积重复绑定
    uniqRolePerm: unique('iam_role_permission_role_code_permission_code_unique').on(
      table.roleCode,
      table.permissionCode,
    ),
  }),
);

export type IamRolePermissionRow = typeof iamRolePermission.$inferSelect;
export type NewIamRolePermission = typeof iamRolePermission.$inferInsert;
