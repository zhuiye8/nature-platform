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
} from 'drizzle-orm/pg-core';

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

  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean('deleted').notNull().default(false),
});

export type ProjectSystemItemRow = typeof projectSystemItem.$inferSelect;
export type NewProjectSystemItem = typeof projectSystemItem.$inferInsert;

// ---------------------------------------------------------------------------
// project_system_serial — per (contract, year) counter for system numbers
// Used by project.listener on PROJECT_REVIEW APPROVE to generate system_no.
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
export const policeRegister = pgTable('police_register', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectRegisterId: bigint('project_register_id', { mode: 'number' }).notNull(),
  registerNo: varchar('register_no', { length: 128 }),
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
});

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
