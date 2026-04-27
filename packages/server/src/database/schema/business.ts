import {
  pgTable,
  bigint,
  varchar,
  boolean,
  timestamp,
  text,
  integer,
  smallint,
  jsonb,
  decimal,
  date,
  primaryKey,
  check,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// customer
// ---------------------------------------------------------------------------
export const customer = pgTable('customer', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 128 }),
  region: varchar('region', { length: 128 }),
  addressDetail: varchar('address_detail', { length: 255 }),
  uscc: varchar('uscc', { length: 64 }),
  isGovernment: boolean('is_government').notNull().default(false),
  remark: text('remark'),

  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type CustomerRow = typeof customer.$inferSelect;
export type NewCustomer = typeof customer.$inferInsert;

// ---------------------------------------------------------------------------
// customer_contact (one-to-many: customer has many contacts)
// ---------------------------------------------------------------------------
export const customerContact = pgTable('customer_contact', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  contactName: varchar('contact_name', { length: 128 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 32 }),
  position: varchar('position', { length: 64 }),
  remark: varchar('remark', { length: 500 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CustomerContactRow = typeof customerContact.$inferSelect;
export type NewCustomerContact = typeof customerContact.$inferInsert;

// ---------------------------------------------------------------------------
// partner
// ---------------------------------------------------------------------------
export const partner = pgTable('partner', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 128 }),
  contactPhone: varchar('contact_phone', { length: 32 }),
  remark: text('remark'),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PartnerRow = typeof partner.$inferSelect;
export type NewPartner = typeof partner.$inferInsert;

// ---------------------------------------------------------------------------
// contract_group
// ---------------------------------------------------------------------------
export const contractGroup = pgTable('contract_group', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupName: varchar('group_name', { length: 255 }).notNull(),
  remark: text('remark'),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// contract
// ---------------------------------------------------------------------------
export const contract = pgTable('contract', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).notNull(),
  contractCategory: varchar('contract_category', { length: 32 }),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),

  contractNo: varchar('contract_no', { length: 64 }),
  contractName: varchar('contract_name', { length: 500 }),
  contactName: varchar('contact_name', { length: 64 }),
  contactPhone: varchar('contact_phone', { length: 32 }),
  paymentCompany: varchar('payment_company', { length: 255 }),
  paymentAmount: decimal('payment_amount', { precision: 18, scale: 2 }),
  paymentMethod: varchar('payment_method', { length: 128 }),
  paymentInfo: text('payment_info'),
  invoiceType: varchar('invoice_type', { length: 16 }),
  taxRate: varchar('tax_rate', { length: 8 }),
  partnerName: varchar('partner_name', { length: 255 }),
  partnerId: bigint('partner_id', { mode: 'number' }),
  salesPersonId: bigint('sales_person_id', { mode: 'number' }),
  performanceCity: varchar('performance_city', { length: 64 }),
  dealStatus: varchar('deal_status', { length: 64 }),
  serviceContent: varchar('service_content', { length: 64 }),
  contractType: varchar('contract_type', { length: 32 }),
  serviceYears: jsonb('service_years').notNull().default([]),
  serviceYearDetail: text('service_year_detail'),

  paymentStatus: varchar('payment_status', { length: 32 }).notNull().default('UNPAID'),
  paymentRemark: text('payment_remark'),
  financialHandlerId: bigint('financial_handler_id', { mode: 'number' }),
  signedAt: timestamp('signed_at', { withTimezone: true }),

  archiveStatus: varchar('archive_status', { length: 32 }).notNull().default('PENDING_ARCHIVE'),
  fileCount: integer('file_count'),
  storageLocation: varchar('storage_location', { length: 255 }),
  archiveRemark: text('archive_remark'),
  archivedBy: bigint('archived_by', { mode: 'number' }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  scanFileUrl: varchar('scan_file_url', { length: 512 }),

  reviewStatus: varchar('review_status', { length: 32 }).notNull().default('DRAFT'),
  systemQuotaFull: boolean('system_quota_full').notNull().default(false),

  remark: text('remark'),

  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type ContractRow = typeof contract.$inferSelect;
export type NewContract = typeof contract.$inferInsert;

// ---------------------------------------------------------------------------
// contract_system_item
// ---------------------------------------------------------------------------
export const contractSystemItem = pgTable('contract_system_item', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  contractId: bigint('contract_id', { mode: 'number' }).notNull(),
  systemName: varchar('system_name', { length: 255 }).notNull(),
  systemLevel: smallint('system_level').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
});

export type ContractSystemItemRow = typeof contractSystemItem.$inferSelect;
export type NewContractSystemItem = typeof contractSystemItem.$inferInsert;

// ---------------------------------------------------------------------------
// contract_serial
// ---------------------------------------------------------------------------
export const contractSerial = pgTable('contract_serial', {
  serialYear: integer('serial_year').notNull(),
  serviceContentCode: varchar('service_content_code', { length: 8 }).notNull(),
  nextSeq: integer('next_seq').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.serialYear, table.serviceContentCode] }),
]);

export type ContractSerialRow = typeof contractSerial.$inferSelect;
export type NewContractSerial = typeof contractSerial.$inferInsert;

// ---------------------------------------------------------------------------
// project_register
// ---------------------------------------------------------------------------
export const projectRegister = pgTable('project_register', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  contractId: bigint('contract_id', { mode: 'number' }).notNull(),
  contractYear: integer('contract_year').notNull(),
  applicationName: varchar('application_name', { length: 500 }).notNull(),
  applicationNo: varchar('application_no', { length: 32 }),
  remark: text('remark'),
  status: varchar('status', { length: 32 }).notNull().default('DRAFT'),

  compiledBy: bigint('compiled_by', { mode: 'number' }),
  compiledAt: timestamp('compiled_at', { withTimezone: true }),

  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type ProjectRegisterRow = typeof projectRegister.$inferSelect;
export type NewProjectRegister = typeof projectRegister.$inferInsert;

// ---------------------------------------------------------------------------
// project_system_item
// ---------------------------------------------------------------------------
export const projectSystemItem = pgTable('project_system_item', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
  systemNo: varchar('system_no', { length: 128 }),
  systemName: varchar('system_name', { length: 255 }).notNull(),
  filingAgency: varchar('filing_agency', { length: 255 }),
  // 备案地区完整级联路径 (格式: "省/市/区")，用于编辑时 cascader 完整回显。
  // filingAgency 只保留省市两级 (业务规则: 公安机关到市级)，区级信息在此字段保留。
  filingRegion: varchar('filing_region', { length: 128 }),
  securityLevel: varchar('security_level', { length: 64 }),
  isReassessment: boolean('is_reassessment').notNull().default(false),
  requiredEntryDate: date('required_entry_date'),
  requiredReportDeliveryDate: date('required_report_delivery_date'),

  assessedUnitName: varchar('assessed_unit_name', { length: 255 }),
  assessedUnitIndustry: varchar('assessed_unit_industry', { length: 128 }),
  assessedUnitContact: varchar('assessed_unit_contact', { length: 64 }),
  assessedUnitMobile: varchar('assessed_unit_mobile', { length: 32 }),
  assessedUnitAddress: varchar('assessed_unit_address', { length: 255 }),

  hasFilingCertificate: boolean('has_filing_certificate').notNull().default(false),
  filingCertificateNo: varchar('filing_certificate_no', { length: 128 }),
  filingCertificateIssuedAt: date('filing_certificate_issued_at'),

  hasFilingForm: boolean('has_filing_form').notNull().default(false),
  hasClassificationReport: boolean('has_classification_report').notNull().default(false),

  // 系统金额（开票申请页面录入入口；可在后续申请中修改覆盖）
  amount: decimal('amount', { precision: 18, scale: 2 }),

  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
});

export type ProjectSystemItemRow = typeof projectSystemItem.$inferSelect;
export type NewProjectSystemItem = typeof projectSystemItem.$inferInsert;

// ---------------------------------------------------------------------------
// project_system_serial — per (contract, year) counter for system numbers
// Used by project.listener on DIRECTOR_REVIEW APPROVE to generate system_no.
// ---------------------------------------------------------------------------
export const projectSystemSerial = pgTable(
  'project_system_serial',
  {
    contractId: bigint('contract_id', { mode: 'number' }).notNull(),
    yearShort: varchar('year_short', { length: 4 }).notNull(),
    nextSeq: integer('next_seq').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.contractId, t.yearShort] })],
);

export type ProjectSystemSerialRow = typeof projectSystemSerial.$inferSelect;
export type NewProjectSystemSerial = typeof projectSystemSerial.$inferInsert;

// ---------------------------------------------------------------------------
// project_reminder_log — 项目级"已发提醒"幂等标记表
// 每 (project_id, event_type) 最多一条，保证同一种提醒对某个项目只发一次。
// 由定时任务 reminder.scheduler 写入。
//   - ENTRY_OVERDUE: 录入时间超过 30 天（发给项目主管）
//   - REPORT_DUE   : 最早要求出报告日期已到（发给项目主管 + PM）
// ---------------------------------------------------------------------------
export const projectReminderLog = pgTable(
  'project_reminder_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    projectId: bigint('project_id', { mode: 'number' }).notNull(),
    eventType: varchar('event_type', { length: 32 }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('project_reminder_log_project_event_uq').on(t.projectId, t.eventType),
  ],
);

export type ProjectReminderLogRow = typeof projectReminderLog.$inferSelect;
export type NewProjectReminderLog = typeof projectReminderLog.$inferInsert;

// ---------------------------------------------------------------------------
// project_member
// ---------------------------------------------------------------------------
export const projectMember = pgTable('project_member', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectId: bigint('project_id', { mode: 'number' }).notNull(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  roleType: varchar('role_type', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  assignedBy: bigint('assigned_by', { mode: 'number' }).notNull(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
});

export type ProjectMemberRow = typeof projectMember.$inferSelect;
export type NewProjectMember = typeof projectMember.$inferInsert;

// ---------------------------------------------------------------------------
// police_register
// ---------------------------------------------------------------------------
export const policeRegister = pgTable(
  'police_register',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
    filingAgency: varchar('filing_agency', { length: 255 }),
    contactName: varchar('contact_name', { length: 64 }),
    contactPhone: varchar('contact_phone', { length: 32 }),
    projectManagerId: bigint('project_manager_id', { mode: 'number' }),
    scanFileUrl: varchar('scan_file_url', { length: 512 }),
    remark: text('remark'),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),

    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // DB-level enforcement: status must be PENDING (待登记) or COMPLETED (已登记).
    // Legacy 'DRAFT' value from pre-0008 data has been backfilled by
    // scripts/backfill-police-status.sql; application code only writes
    // PENDING/COMPLETED (see police.listener.ts).
    check(
      'police_register_status_check',
      sql`${t.status} IN ('PENDING', 'COMPLETED')`,
    ),
  ],
);

export type PoliceRegisterRow = typeof policeRegister.$inferSelect;
export type NewPoliceRegister = typeof policeRegister.$inferInsert;

// ---------------------------------------------------------------------------
// on_site_assessment
// ---------------------------------------------------------------------------
export const onSiteAssessment = pgTable('on_site_assessment', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
  assessmentDetail: text('assessment_detail'),
  assessmentRemark: text('assessment_remark'),
  status: varchar('status', { length: 32 }).notNull().default('DRAFT'),

  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type OnSiteAssessmentRow = typeof onSiteAssessment.$inferSelect;
export type NewOnSiteAssessment = typeof onSiteAssessment.$inferInsert;

// ---------------------------------------------------------------------------
// material_archive
// ---------------------------------------------------------------------------
export const materialArchive = pgTable('material_archive', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
  materialStatusCodes: jsonb('material_status_codes').notNull().default([]),
  remark: varchar('remark', { length: 1000 }),
  status: varchar('status', { length: 32 }).notNull().default('DRAFT'),

  fileCount: integer('file_count'),
  storageLocation: varchar('storage_location', { length: 500 }),
  submittedBy: bigint('submitted_by', { mode: 'number' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  updatedBy: bigint('updated_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MaterialArchiveRow = typeof materialArchive.$inferSelect;
export type NewMaterialArchive = typeof materialArchive.$inferInsert;

// ---------------------------------------------------------------------------
// registration_platform (注册平台管理)
// ---------------------------------------------------------------------------
export const registrationPlatform = pgTable('registration_platform', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  platformName: varchar('platform_name', { length: 255 }),
  websiteUrl: varchar('website_url', { length: 500 }),
  account: varchar('account', { length: 128 }),
  password: varchar('password', { length: 255 }),
  hasCa: boolean('has_ca').notNull().default(false),
  caExpireDate: date('ca_expire_date'),
  caPassword: varchar('ca_password', { length: 255 }),
  contactName: varchar('contact_name', { length: 64 }),
  contactPhone: varchar('contact_phone', { length: 32 }),
  remark: text('remark'),

  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// contract_payment_record (回款明细)
// 编辑入口仅在合同财务详情页 → 添加回款弹窗。
// 每条记录留痕 created_by + created_at，业务上不允许编辑/删除（如需改正
// 由 super_admin 在数据库层操作）。
// ---------------------------------------------------------------------------
export const contractPaymentRecord = pgTable('contract_payment_record', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  contractId: bigint('contract_id', { mode: 'number' }).notNull(),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  paidAt: date('paid_at').notNull(),
  payer: varchar('payer', { length: 255 }),
  remark: text('remark'),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ContractPaymentRecordRow = typeof contractPaymentRecord.$inferSelect;
export type NewContractPaymentRecord = typeof contractPaymentRecord.$inferInsert;

// ---------------------------------------------------------------------------
// finance_invoice_application (开票申请)
// 状态机：DRAFT → SUBMITTED → APPROVED(已开票) / REJECTED(需修改)
// REJECTED 可重新编辑提交（启动新 wf_instance + roundNo 累加）
// ---------------------------------------------------------------------------
export const financeInvoiceApplication = pgTable(
  'finance_invoice_application',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    contractId: bigint('contract_id', { mode: 'number' }).notNull(),
    invoiceContent: text('invoice_content').notNull(),
    applyAmount: decimal('apply_amount', { precision: 18, scale: 2 }).notNull(),
    invoiceType: varchar('invoice_type', { length: 16 }).notNull(),
    taxRate: varchar('tax_rate', { length: 8 }).notNull(),
    description: text('description'),
    remark: text('remark'),
    status: varchar('status', { length: 32 }).notNull().default('DRAFT'),

    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'finance_invoice_application_status_check',
      sql`${t.status} IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')`,
    ),
  ],
);

export type FinanceInvoiceApplicationRow = typeof financeInvoiceApplication.$inferSelect;
export type NewFinanceInvoiceApplication = typeof financeInvoiceApplication.$inferInsert;

// ---------------------------------------------------------------------------
// finance_invoice_application_system (开票申请-系统多对多)
// 注意：外键指向 project_system_item.id（已通过项目登记审批的系统）
// ---------------------------------------------------------------------------
export const financeInvoiceApplicationSystem = pgTable(
  'finance_invoice_application_system',
  {
    invoiceApplicationId: bigint('invoice_application_id', { mode: 'number' }).notNull(),
    projectSystemItemId: bigint('project_system_item_id', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.invoiceApplicationId, t.projectSystemItemId] }),
  ],
);

export type FinanceInvoiceApplicationSystemRow = typeof financeInvoiceApplicationSystem.$inferSelect;
export type NewFinanceInvoiceApplicationSystem = typeof financeInvoiceApplicationSystem.$inferInsert;

// ---------------------------------------------------------------------------
// finance_expense_request (费用请款)
// 状态机:
//   DRAFT --submit-->        SUBMITTED
//   SUBMITTED -部门 APPROVE-> DEPT_APPROVED
//   DEPT_APPROVED -财务 APPROVE-> APPROVED
//   任意阶段 REJECT --->        REJECTED (编辑后重提启动新 wf_instance + roundNo+1)
//
// 特殊规则:
//   - 差旅费: invoice_type / tax_rate / invoice_amount 可为 NULL
//   - 合作费: partner_* 字段必填 (默认从 contract 回填)
//   - 银行账号: ^\d{10,30}$ (兼容个人卡 + 对公账户)
// ---------------------------------------------------------------------------
export const financeExpenseRequest = pgTable(
  'finance_expense_request',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    contractId: bigint('contract_id', { mode: 'number' }).notNull(),

    // 费用类型: 报名费/代理费/专家费/合作费/项目提成/差旅费/其它
    expenseType: varchar('expense_type', { length: 32 }).notNull(),
    requestAmount: decimal('request_amount', { precision: 18, scale: 2 }).notNull(),

    // 发票信息 (差旅费时可为 NULL)
    invoiceType: varchar('invoice_type', { length: 16 }),
    taxRate: varchar('tax_rate', { length: 8 }),
    invoiceAmount: decimal('invoice_amount', { precision: 18, scale: 2 }),

    // 收款人信息
    payeeName: varchar('payee_name', { length: 128 }).notNull(),
    payeeBank: varchar('payee_bank', { length: 255 }).notNull(),
    payeeAccount: varchar('payee_account', { length: 64 }).notNull(),

    // 合作方信息 (合作费时必填，默认从 contract 回填)
    partnerId: bigint('partner_id', { mode: 'number' }),
    partnerName: varchar('partner_name', { length: 255 }),
    partnerAmount: decimal('partner_amount', { precision: 18, scale: 2 }),
    partnerInvoiceType: varchar('partner_invoice_type', { length: 16 }),
    partnerTaxRate: varchar('partner_tax_rate', { length: 8 }),

    remark: text('remark'),
    status: varchar('status', { length: 32 }).notNull().default('DRAFT'),

    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'finance_expense_request_status_check',
      sql`${t.status} IN ('DRAFT', 'SUBMITTED', 'DEPT_APPROVED', 'APPROVED', 'REJECTED')`,
    ),
  ],
);

export type FinanceExpenseRequestRow = typeof financeExpenseRequest.$inferSelect;
export type NewFinanceExpenseRequest = typeof financeExpenseRequest.$inferInsert;

// ---------------------------------------------------------------------------
// finance_expense_request_system (费用请款-系统多对多)
// 外键指向 project_system_item.id (与开票申请一致)
// ---------------------------------------------------------------------------
export const financeExpenseRequestSystem = pgTable(
  'finance_expense_request_system',
  {
    expenseRequestId: bigint('expense_request_id', { mode: 'number' }).notNull(),
    projectSystemItemId: bigint('project_system_item_id', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.expenseRequestId, t.projectSystemItemId] }),
  ],
);

export type FinanceExpenseRequestSystemRow = typeof financeExpenseRequestSystem.$inferSelect;
export type NewFinanceExpenseRequestSystem = typeof financeExpenseRequestSystem.$inferInsert;
