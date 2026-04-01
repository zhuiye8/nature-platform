-- ============================================================================
-- Nature 等保测评平台 — PostgreSQL 16 Complete Schema
-- Target: NestJS + Drizzle ORM + TypeScript
-- Generated: 2026-03-23
-- ============================================================================
--
-- DESIGN DECISIONS vs CODEX:
--
-- 1. IDENTITY COLUMNS: Codex used AUTO_INCREMENT (MySQL). We use
--    GENERATED ALWAYS AS IDENTITY (SQL-standard, PostgreSQL 10+).
--    This prevents manual ID injection and works cleanly with Drizzle.
--
-- 2. TIMESTAMPTZ everywhere: Codex used DATETIME (no timezone). We use
--    TIMESTAMPTZ so all timestamps are UTC-stored, timezone-aware.
--    Application layer converts to Asia/Shanghai for display.
--
-- 3. BOOLEAN over TINYINT: Codex used TINYINT(1). PostgreSQL native BOOLEAN.
--
-- 4. JSONB over TEXT: Codex stored JSON as TEXT columns (service_years_json,
--    evidence_files_json, etc.). We use JSONB for indexable, queryable JSON.
--
-- 5. FK references use BIGINT user IDs instead of VARCHAR usernames.
--    Codex referenced users by username strings everywhere (created_by VARCHAR).
--    This was fragile -- renaming a user would break all references.
--    We reference user_account.id consistently.
--
-- 6. UNIFIED WORKFLOW: Codex had 10+ per-node tables (quality_review_apply,
--    quality_review_task, report_tech_review_apply, report_tech_review_task,
--    report_content_review_apply, report_content_review_task,
--    report_compile_assignment, report_compile_submission,
--    report_final_review_apply, report_final_review_task).
--    All replaced by wf_instance + wf_task (2 tables).
--
-- 7. STRUCTURED WORKFLOW ENGINE: Codex had workflow_definition_registry (flat
--    node list), workflow_node_rule, workflow_node_rule_item. We have proper
--    wf_definition -> wf_node -> wf_transition graph + wf_assignment_rule.
--
-- 8. CONTACT MERGED INTO CUSTOMER: Codex had contact fields on both customer
--    and contract. We keep contact_name/mobile_phone on customer only.
--    Contract references customer for contact info.
--
-- 9. project_member replaces project_assessment_member + workflow_assignment:
--    Single table tracks all project role assignments (PM, assessor, reviewers,
--    report writer) with proper lifecycle (assigned_at, removed_at).
--
-- 10. SOFT DELETE: Codex used deleted_flag TINYINT(1). We use
--     deleted BOOLEAN DEFAULT FALSE + deleted_at TIMESTAMPTZ.
--
-- 11. CASL-COMPATIBLE PERMISSIONS: iam_permission uses subject+action pattern
--     matching CASL's ability definition model, enabling shared permission
--     logic between NestJS backend and Vue frontend.
--
-- 12. file_attachment: New table for MinIO metadata. Codex stored file paths
--     as VARCHAR columns scattered across business tables. We centralize
--     file metadata with polymorphic biz_type/biz_id references.
--
-- ============================================================================

-- ============================================================================
-- SECTION 0: INFRASTRUCTURE FUNCTIONS
-- ============================================================================

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_set_updated_at IS 'Trigger function to auto-set updated_at. Applied to all tables with updated_at column.';

-- ============================================================================
-- SECTION 1: SYSTEM / IAM TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 user_account
-- ---------------------------------------------------------------------------
CREATE TABLE user_account (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        VARCHAR(64)   NOT NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    must_change_pwd BOOLEAN       NOT NULL DEFAULT FALSE,
    display_name    VARCHAR(128)  NOT NULL,
    avatar_url      VARCHAR(512)  NULL,
    mobile          VARCHAR(32)   NULL,
    email           VARCHAR(128)  NULL,
    enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
    source_type     VARCHAR(16)   NOT NULL DEFAULT 'LOCAL',
        -- LOCAL | DINGTALK

    -- DingTalk SSO fields
    dept_id         BIGINT        NULL,
    ding_user_id    VARCHAR(64)   NULL,
    ding_union_id   VARCHAR(128)  NULL,
    ding_job_number VARCHAR(64)   NULL,
    last_sync_at    TIMESTAMPTZ   NULL,

    -- Audit
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_user_account_username     UNIQUE (username),
    CONSTRAINT uk_user_account_ding_user    UNIQUE (ding_user_id),
    CONSTRAINT uk_user_account_ding_union   UNIQUE (ding_union_id)
);

CREATE INDEX idx_user_account_dept     ON user_account (dept_id);
CREATE INDEX idx_user_account_enabled  ON user_account (enabled);

COMMENT ON TABLE  user_account IS 'Platform user accounts (local + DingTalk SSO)';
COMMENT ON COLUMN user_account.source_type IS 'LOCAL = password login, DINGTALK = SSO';

-- ---------------------------------------------------------------------------
-- 1.2 iam_department
-- ---------------------------------------------------------------------------
CREATE TABLE iam_department (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dept_code       VARCHAR(64)   NOT NULL,
    dept_name       VARCHAR(128)  NOT NULL,
    parent_id       BIGINT        NULL REFERENCES iam_department(id),
    source_type     VARCHAR(16)   NOT NULL DEFAULT 'LOCAL',
    ding_dept_id    VARCHAR(64)   NULL,
    default_role_code VARCHAR(64) NULL,
    enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order      INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_iam_dept_code     UNIQUE (dept_code),
    CONSTRAINT uk_iam_dept_ding     UNIQUE (ding_dept_id)
);

CREATE INDEX idx_iam_dept_parent  ON iam_department (parent_id);
CREATE INDEX idx_iam_dept_enabled ON iam_department (enabled);

COMMENT ON TABLE iam_department IS 'Organization departments (display/filter only, not for permission)';

-- ---------------------------------------------------------------------------
-- 1.3 iam_role
-- ---------------------------------------------------------------------------
CREATE TABLE iam_role (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_code       VARCHAR(64)   NOT NULL,
    role_name       VARCHAR(128)  NOT NULL,
    description     VARCHAR(500)  NULL,
    system_flag     BOOLEAN       NOT NULL DEFAULT FALSE,
        -- TRUE = built-in, cannot be deleted
    enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order      INT           NOT NULL DEFAULT 0,
        -- Global role display order (also used as tiebreaker in admin UI)
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_iam_role_code UNIQUE (role_code)
);

COMMENT ON TABLE iam_role IS 'RBAC roles. Permissions are purely role-driven (no dept-based scoping).';

-- ---------------------------------------------------------------------------
-- 1.4 user_role  (user <-> role mapping, with sort_order for auto-assignment)
-- ---------------------------------------------------------------------------
CREATE TABLE user_role (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT        NOT NULL REFERENCES user_account(id),
    role_code       VARCHAR(64)   NOT NULL,
    sort_order      INT           NOT NULL DEFAULT 0,
        -- Lower = higher priority for auto-assignment candidate selection
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_user_role UNIQUE (user_id, role_code)
);

CREATE INDEX idx_user_role_code ON user_role (role_code);
CREATE INDEX idx_user_role_sort ON user_role (role_code, sort_order, user_id);

COMMENT ON TABLE  user_role IS 'User-to-role mapping. sort_order determines candidate priority for workflow auto-assignment.';

-- ---------------------------------------------------------------------------
-- 1.5 iam_permission  (CASL-compatible: subject + action)
-- ---------------------------------------------------------------------------
CREATE TABLE iam_permission (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    permission_code VARCHAR(128)  NOT NULL,
        -- Format: "subject:action" e.g. "customer:create", "contract:review"
        -- Maps to CASL: can(action, subject)
    permission_name VARCHAR(128)  NOT NULL,
    category        VARCHAR(64)   NOT NULL,
        -- Grouping for UI: 'CUSTOMER', 'CONTRACT', 'PROJECT', 'WORKFLOW', 'IAM', 'AUDIT'
    description     VARCHAR(500)  NULL,
    enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
    built_in        BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_iam_permission_code UNIQUE (permission_code)
);

COMMENT ON TABLE iam_permission IS 'Permission catalog. Code format is "subject:action" for CASL compatibility.';

-- ---------------------------------------------------------------------------
-- 1.6 iam_role_permission
-- ---------------------------------------------------------------------------
CREATE TABLE iam_role_permission (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_code       VARCHAR(64)   NOT NULL,
    permission_code VARCHAR(128)  NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_role_perm UNIQUE (role_code, permission_code)
);

CREATE INDEX idx_role_perm_code ON iam_role_permission (permission_code);

-- ---------------------------------------------------------------------------
-- 1.7 iam_resource  (menu/page/button tree for frontend routing)
-- ---------------------------------------------------------------------------
CREATE TABLE iam_resource (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resource_key    VARCHAR(128)  NOT NULL,
        -- e.g. "group.business", "page.customers", "btn.customer.create"
    resource_name   VARCHAR(128)  NOT NULL,
    resource_type   VARCHAR(16)   NOT NULL,
        -- GROUP | PAGE | BUTTON
    parent_key      VARCHAR(128)  NULL,
    route_path      VARCHAR(255)  NULL,
    icon            VARCHAR(64)   NULL,
    sort_order      INT           NOT NULL DEFAULT 0,
    enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
    built_in        BOOLEAN       NOT NULL DEFAULT TRUE,
    description     VARCHAR(500)  NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_iam_resource_key UNIQUE (resource_key)
);

CREATE INDEX idx_iam_resource_parent  ON iam_resource (parent_key);
CREATE INDEX idx_iam_resource_enabled ON iam_resource (enabled);

COMMENT ON TABLE iam_resource IS 'Frontend navigation tree. Roles map to resources for dynamic menu rendering.';

-- ---------------------------------------------------------------------------
-- 1.8 iam_role_resource
-- ---------------------------------------------------------------------------
CREATE TABLE iam_role_resource (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_code       VARCHAR(64)   NOT NULL,
    resource_key    VARCHAR(128)  NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_role_resource UNIQUE (role_code, resource_key)
);

CREATE INDEX idx_role_resource_key ON iam_role_resource (resource_key);

-- ---------------------------------------------------------------------------
-- 1.9 system_notification
-- ---------------------------------------------------------------------------
CREATE TABLE system_notification (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receiver_id     BIGINT        NOT NULL REFERENCES user_account(id),
    title           VARCHAR(255)  NOT NULL,
    content         TEXT          NOT NULL,
    read_flag       BOOLEAN       NOT NULL DEFAULT FALSE,
    event_type      VARCHAR(64)   NULL,
        -- WORKFLOW_TASK | CONTRACT_APPROVED | ARCHIVE_COMPLETE | ...
    ref_type        VARCHAR(64)   NULL,
        -- Links notification to business entity
    ref_id          BIGINT        NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_receiver ON system_notification (receiver_id, read_flag, created_at DESC);
CREATE INDEX idx_notification_ref      ON system_notification (ref_type, ref_id);

COMMENT ON TABLE system_notification IS 'Persistent notifications. SSE pushes new entries in real-time. Physical delete allowed.';

-- ---------------------------------------------------------------------------
-- 1.10 field_change_log  (field-level audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE field_change_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    biz_type        VARCHAR(64)   NOT NULL,
    biz_id          BIGINT        NOT NULL,
    field_name      VARCHAR(128)  NOT NULL,
    old_value       TEXT          NULL,
    new_value       TEXT          NULL,
    operator_id     BIGINT        NOT NULL,
    operated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_field_change_biz ON field_change_log (biz_type, biz_id, operated_at);
CREATE INDEX idx_field_change_op  ON field_change_log (operator_id, operated_at);

COMMENT ON TABLE field_change_log IS 'Field-level change audit. Service layer diffs old/new and inserts rows.';

-- ---------------------------------------------------------------------------
-- 1.11 admin_audit_log  (admin operations audit)
-- ---------------------------------------------------------------------------
CREATE TABLE admin_audit_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    operator_id     BIGINT        NOT NULL,
    action_type     VARCHAR(64)   NOT NULL,
        -- USER_CREATE | ROLE_UPDATE | WORKFLOW_DEPLOY | ...
    target_type     VARCHAR(64)   NOT NULL,
    target_id       VARCHAR(128)  NOT NULL,
    detail          JSONB         NULL,
    ip_address      VARCHAR(45)   NULL,
    user_agent      VARCHAR(512)  NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_operator ON admin_audit_log (operator_id, created_at DESC);
CREATE INDEX idx_audit_action   ON admin_audit_log (action_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- 1.12 file_attachment  (MinIO file metadata registry)
-- ---------------------------------------------------------------------------
CREATE TABLE file_attachment (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    biz_type        VARCHAR(64)   NOT NULL,
        -- CUSTOMER | CONTRACT | PROJECT | ASSESSMENT | REPORT | ARCHIVE | POLICE
    biz_id          BIGINT        NOT NULL,
    node_key        VARCHAR(64)   NULL,
        -- Workflow node that uploaded this file (for cross-node visibility queries)
    slot_key        VARCHAR(64)   NULL,
        -- Sub-category within a node, e.g. "contract_scan", "report_doc"
    file_name       VARCHAR(256)  NOT NULL,
    file_size       BIGINT        NOT NULL DEFAULT 0,
    content_type    VARCHAR(128)  NULL,
    storage_path    VARCHAR(512)  NOT NULL,
        -- MinIO object key: "{biz_type}/{biz_id}/{uuid}.{ext}"
    checksum_sha256 VARCHAR(64)   NULL,
        -- For offline data exchange integrity verification
    uploader_id     BIGINT        NOT NULL,
    uploaded_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ   NULL
);

CREATE INDEX idx_file_biz       ON file_attachment (biz_type, biz_id) WHERE deleted = FALSE;
CREATE INDEX idx_file_uploader   ON file_attachment (uploader_id);
CREATE INDEX idx_file_node       ON file_attachment (biz_type, biz_id, node_key) WHERE deleted = FALSE;

COMMENT ON TABLE file_attachment IS 'Centralized file metadata for MinIO objects. Cross-node visible by querying biz_type+biz_id without node_key filter.';

-- ---------------------------------------------------------------------------
-- 1.13 recycle_bin
-- ---------------------------------------------------------------------------
CREATE TABLE recycle_bin (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    biz_type        VARCHAR(32)   NOT NULL,
        -- CONTRACT | PROJECT_REGISTER
    biz_id          BIGINT        NOT NULL,
    display_name    VARCHAR(500)  NULL,
        -- Snapshot of business record name for display in recycle bin UI
    snapshot_json   JSONB         NULL,
        -- Full snapshot of deleted record for reliable restore
    deleted_by      BIGINT        NOT NULL,
    deleted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    remark          VARCHAR(255)  NULL,

    CONSTRAINT uk_recycle_biz UNIQUE (biz_type, biz_id)
);

COMMENT ON TABLE recycle_bin IS 'Tracks soft-deleted business records. Only super_admin can restore. Restore checks for uniqueness conflicts.';


-- ============================================================================
-- SECTION 2: WORKFLOW ENGINE TABLES  (7 tables)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 wf_definition  (process definition with versioning)
-- ---------------------------------------------------------------------------
CREATE TABLE wf_definition (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    def_key         VARCHAR(64)   NOT NULL,
        -- e.g. "CONTRACT_FLOW", "PROJECT_ASSESSMENT_FLOW"
    version         INT           NOT NULL DEFAULT 1,
    def_name        VARCHAR(128)  NOT NULL,
    description     VARCHAR(500)  NULL,
    status          VARCHAR(16)   NOT NULL DEFAULT 'DRAFT',
        -- DRAFT | ACTIVE | DEPRECATED
    created_by      BIGINT        NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_wf_def_key_ver UNIQUE (def_key, version)
);

CREATE INDEX idx_wf_def_status ON wf_definition (def_key, status);

COMMENT ON TABLE wf_definition IS 'Workflow process definitions. Running instances bind to a specific version. New instances use latest ACTIVE version.';

-- ---------------------------------------------------------------------------
-- 2.2 wf_node  (node definitions within a process)
-- ---------------------------------------------------------------------------
CREATE TABLE wf_node (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    definition_id   BIGINT        NOT NULL REFERENCES wf_definition(id) ON DELETE CASCADE,
    node_key        VARCHAR(64)   NOT NULL,
        -- e.g. "CONTRACT_CREATE", "QUALITY_REVIEW", "ON_SITE_ASSESSMENT"
    node_name       VARCHAR(128)  NOT NULL,
    node_type       VARCHAR(32)   NOT NULL,
        -- SIMPLE | REVIEW | PARALLEL_REVIEW | MULTI_ASSIGNEE | AUTO
    node_order      INT           NOT NULL DEFAULT 0,
    config          JSONB         NULL,
        -- Node-type-specific config. Examples:
        -- PARALLEL_REVIEW: {"slots": ["TECH","CONTENT_A","CONTENT_B","CONTENT_C"]}
        -- MULTI_ASSIGNEE:  {"source": "project_member", "role_types": ["PM","ASSESSOR"]}
        -- REVIEW:          {"reject_target": "CONTRACT_CREATE"}
        -- AUTO:            {"handler": "generateContractNo"}

    CONSTRAINT uk_wf_node_def_key UNIQUE (definition_id, node_key)
);

CREATE INDEX idx_wf_node_def ON wf_node (definition_id, node_order);

COMMENT ON TABLE wf_node IS 'Nodes within a workflow definition. node_type determines handler behavior. config holds type-specific parameters as JSONB.';

-- ---------------------------------------------------------------------------
-- 2.3 wf_transition  (edges between nodes)
-- ---------------------------------------------------------------------------
CREATE TABLE wf_transition (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    definition_id   BIGINT        NOT NULL REFERENCES wf_definition(id) ON DELETE CASCADE,
    from_node_key   VARCHAR(64)   NOT NULL DEFAULT '',
        -- Empty string = start pseudo-node
    to_node_key     VARCHAR(64)   NOT NULL DEFAULT '',
        -- Empty string = end pseudo-node
    event           VARCHAR(64)   NOT NULL,
        -- SUBMIT | APPROVE | REJECT | ALL_COMPLETE | ALL_APPROVED | ANY_REJECTED | AUTO
    guard_expr      VARCHAR(500)  NULL,
        -- Optional condition expression (future: CEL or simple JS eval)
    priority        INT           NOT NULL DEFAULT 0,
        -- Higher priority evaluated first (for multiple transitions from same node+event)

    CONSTRAINT uk_wf_trans UNIQUE (definition_id, from_node_key, event, priority)
);

CREATE INDEX idx_wf_trans_from ON wf_transition (definition_id, from_node_key);

COMMENT ON TABLE wf_transition IS 'Directed edges in workflow graph. TransitionResolver evaluates guard_expr and selects highest-priority match.';

-- ---------------------------------------------------------------------------
-- 2.4 wf_instance  (running process instances)
-- ---------------------------------------------------------------------------
CREATE TABLE wf_instance (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    definition_id   BIGINT        NOT NULL REFERENCES wf_definition(id),
    biz_type        VARCHAR(64)   NOT NULL,
        -- CONTRACT | PROJECT_REGISTER
    biz_id          BIGINT        NOT NULL,
    current_node    VARCHAR(64)   NOT NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'RUNNING',
        -- RUNNING | COMPLETED | CANCELLED
    started_by      BIGINT        NOT NULL,
    started_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ   NULL,
    variables       JSONB         NULL,
        -- Process-level variables (e.g. generated contract_no, assignment results)

    CONSTRAINT uk_wf_instance_biz UNIQUE (biz_type, biz_id)
);

ALTER TABLE wf_instance ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX idx_wf_instance_status ON wf_instance (biz_type, status, updated_at);

COMMENT ON TABLE wf_instance IS 'Active workflow instances. Bound to a specific definition version. One instance per business record.';

-- ---------------------------------------------------------------------------
-- 2.5 wf_task  (individual tasks within a node)
-- ---------------------------------------------------------------------------
CREATE TABLE wf_task (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instance_id     BIGINT        NOT NULL REFERENCES wf_instance(id),
    node_key        VARCHAR(64)   NOT NULL,
    slot_key        VARCHAR(64)   NULL,
        -- For PARALLEL_REVIEW: "TECH", "CONTENT_A", "CONTENT_B", "CONTENT_C"
        -- For MULTI_ASSIGNEE: user-specific key or NULL
        -- For SIMPLE/REVIEW: NULL
    assignee_id     BIGINT        NULL,
        -- NULL when task is in a pool (unassigned)
    status          VARCHAR(32)   NOT NULL DEFAULT 'PENDING',
        -- PENDING | IN_PROGRESS | COMPLETED | CANCELLED | SKIPPED
    result          VARCHAR(32)   NULL,
        -- APPROVED | REJECTED | SUBMITTED | null (pending)
    remark          VARCHAR(1000) NULL,
    form_data       JSONB         NULL,
        -- Task-specific form data submitted by assignee
    completed_at    TIMESTAMPTZ   NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_task_instance  ON wf_task (instance_id, node_key);
CREATE INDEX idx_wf_task_assignee  ON wf_task (assignee_id, status, updated_at DESC)
    WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_wf_task_pending   ON wf_task (status, created_at)
    WHERE status = 'PENDING';

COMMENT ON TABLE wf_task IS 'Unified task table replacing all per-node apply/task tables from codex. Supports SIMPLE, REVIEW, PARALLEL_REVIEW, and MULTI_ASSIGNEE patterns.';

-- ---------------------------------------------------------------------------
-- 2.6 wf_assignment_rule  (auto-assignment candidate pool configuration)
-- ---------------------------------------------------------------------------
CREATE TABLE wf_assignment_rule (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    node_key        VARCHAR(64)   NOT NULL,
        -- Which workflow node this rule applies to
    slot_key        VARCHAR(64)   NOT NULL,
        -- Which slot within the node (e.g. "TECH", "CONTENT_A")
    slot_label      VARCHAR(128)  NOT NULL,
        -- Display name (e.g. "Technical Reviewer", "Content Reviewer A")
    role_code       VARCHAR(64)   NOT NULL,
        -- Candidate comes from users with this role
    avoidance_rule  VARCHAR(32)   NOT NULL DEFAULT 'NONE',
        -- NONE | SAME_PROJECT
        -- SAME_PROJECT: exclude users who are project_member for this project
    priority        INT           NOT NULL DEFAULT 0,
        -- Lower = higher priority candidate (selected first)

    CONSTRAINT uk_wf_assign_rule UNIQUE (node_key, slot_key, role_code)
);

CREATE INDEX idx_wf_assign_node ON wf_assignment_rule (node_key);

COMMENT ON TABLE wf_assignment_rule IS 'Defines candidate pools for auto-assignment. AssignmentResolver iterates by priority, applying avoidance rules to find the first eligible candidate.';

-- ---------------------------------------------------------------------------
-- 2.7 wf_action_log  (workflow operation audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE wf_action_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instance_id     BIGINT        NOT NULL REFERENCES wf_instance(id),
    task_id         BIGINT        NULL,
    node_key        VARCHAR(64)   NOT NULL,
    action          VARCHAR(32)   NOT NULL,
        -- SUBMIT | APPROVE | REJECT | REASSIGN | CANCEL | AUTO_COMPLETE
    from_node       VARCHAR(64)   NULL,
    to_node         VARCHAR(64)   NULL,
    operator_id     BIGINT        NOT NULL,
    remark          VARCHAR(1000) NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_action_instance ON wf_action_log (instance_id, created_at);
CREATE INDEX idx_wf_action_operator ON wf_action_log (operator_id, created_at DESC);

COMMENT ON TABLE wf_action_log IS 'Immutable audit trail for all workflow operations. from_node/to_node track state transitions.';


-- ============================================================================
-- SECTION 3: BUSINESS TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 customer  (simplified from codex: contact merged in, no separate table)
-- ---------------------------------------------------------------------------
CREATE TABLE customer (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(255)  NOT NULL,
    industry        VARCHAR(128)  NULL,
    region          VARCHAR(128)  NULL,
    address_detail  VARCHAR(255)  NULL,
    uscc            VARCHAR(64)   NULL,
        -- Unified Social Credit Code (统一社会信用代码)
    contact_name    VARCHAR(64)   NULL,
    mobile_phone    VARCHAR(32)   NULL,
    is_government   BOOLEAN       NOT NULL DEFAULT FALSE,
    remark          TEXT          NULL,

    -- Audit + Soft delete
    created_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_by      BIGINT        NULL,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ   NULL
);

CREATE INDEX idx_customer_deleted ON customer (deleted) WHERE deleted = FALSE;
CREATE INDEX idx_customer_creator ON customer (created_by);
CREATE INDEX idx_customer_name    ON customer (full_name);

COMMENT ON TABLE customer IS 'Customer records. Contact info merged directly (no separate contact table). Visible to all users.';

-- ---------------------------------------------------------------------------
-- 3.2 partner (维护合作方信息)
-- ---------------------------------------------------------------------------
CREATE TABLE partner (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(255)  NOT NULL UNIQUE,
    contact_name    VARCHAR(128)  NULL,
    contact_phone   VARCHAR(32)   NULL,
    remark          TEXT          NULL,
    created_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE partner IS 'Partner/collaborator companies. Maintained independently, referenced by contract.partner_id.';

-- ---------------------------------------------------------------------------
-- 3.3 contract
-- ---------------------------------------------------------------------------
CREATE TABLE contract (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT        NOT NULL,

    -- Contract identification (generated on review approval)
    contract_no     VARCHAR(64)   NULL,
        -- Format: YZN-YYYY-0001 (4-digit seq, reset yearly)
    contract_name   VARCHAR(500)  NULL,
        -- Auto-generated: customer + systems + service years

    -- Contact info
    contact_name    VARCHAR(64)   NULL,
    contact_phone   VARCHAR(32)   NULL,

    -- Business fields
    payment_company VARCHAR(255)  NULL,
    payer_type      VARCHAR(16)   NULL,
    payer_id        BIGINT        NULL,
    payment_amount  DECIMAL(18,2) NULL,
    payment_method  VARCHAR(128)  NULL,
    partner_name    VARCHAR(255)  NULL,
    partner_id      BIGINT        NULL,
    sales_person_id BIGINT        NULL,
    performance_city VARCHAR(64)  NULL,
    deal_status     VARCHAR(64)   NULL,
    contract_type   VARCHAR(64)   NULL,
    service_years   JSONB         NOT NULL DEFAULT '[]',
        -- Array of years: [2026, 2027, 2028]
    service_year_detail TEXT      NULL,

    -- Financial
    payment_status  VARCHAR(32)   NOT NULL DEFAULT 'UNPAID',
    payment_remark  TEXT          NULL,
    signed_at       TIMESTAMPTZ   NULL,

    -- Archive fields (filled by commercial role at archive step)
    archive_status  VARCHAR(32)   NOT NULL DEFAULT 'PENDING_ARCHIVE',
        -- PENDING_ARCHIVE | ARCHIVED
    file_count      INT           NULL,
    storage_location VARCHAR(255) NULL,
    archive_remark  TEXT          NULL,
    archived_by     BIGINT        NULL,
    scan_file_url   VARCHAR(512)  NULL,

    -- Workflow status
    review_status   VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',
        -- DRAFT | SUBMITTED | APPROVED | REJECTED

    remark          TEXT          NULL,

    -- Audit + Soft delete
    created_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_by      BIGINT        NULL,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ   NULL
);

CREATE INDEX idx_contract_customer ON contract (customer_id) WHERE deleted = FALSE;
CREATE INDEX idx_contract_status   ON contract (review_status, archive_status) WHERE deleted = FALSE;
CREATE INDEX idx_contract_deleted  ON contract (deleted) WHERE deleted = FALSE;
CREATE INDEX idx_contract_creator  ON contract (created_by);

COMMENT ON TABLE contract IS 'Contract records. review_status tracks workflow. archive_status tracks post-approval archiving by commercial role.';

-- ---------------------------------------------------------------------------
-- 3.3 contract_system_item  (systems covered by a contract)
-- ---------------------------------------------------------------------------
CREATE TABLE contract_system_item (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contract_id     BIGINT        NOT NULL,
    system_name     VARCHAR(255)  NOT NULL,
    system_level    SMALLINT      NOT NULL,
        -- Security level: 1, 2, 3, 4, 5
    sort_order      INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_contract_sys_contract ON contract_system_item (contract_id) WHERE deleted = FALSE;

-- ---------------------------------------------------------------------------
-- 3.4 contract_serial  (yearly sequence counter for contract numbers)
-- ---------------------------------------------------------------------------
CREATE TABLE contract_serial (
    serial_year     INT           PRIMARY KEY,
    next_seq        INT           NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE contract_serial IS 'Yearly auto-increment counter for contract numbers. Format: YZN-{year}-{seq:04d}. Uses SELECT FOR UPDATE for concurrency.';

-- ---------------------------------------------------------------------------
-- 3.5 project_register  (project registration applications)
-- ---------------------------------------------------------------------------
CREATE TABLE project_register (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contract_id     BIGINT        NOT NULL,
    contract_year   INT           NOT NULL,
        -- Which service year this project covers
    application_name VARCHAR(500) NOT NULL,
    application_no  VARCHAR(32)   NULL,
    remark          TEXT          NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',

    compiled_by     BIGINT        NULL,
    compiled_at     TIMESTAMPTZ   NULL,
        -- DRAFT | SUBMITTED | APPROVED | REJECTED

    -- Audit + Soft delete
    created_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_by      BIGINT        NULL,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ   NULL
);

-- Uniqueness: one active (non-deleted) project per contract+year
-- PostgreSQL partial unique index handles this cleanly
CREATE UNIQUE INDEX uk_project_contract_year
    ON project_register (contract_id, contract_year)
    WHERE deleted = FALSE;

CREATE INDEX idx_project_status  ON project_register (status) WHERE deleted = FALSE;
CREATE INDEX idx_project_deleted ON project_register (deleted) WHERE deleted = FALSE;

COMMENT ON TABLE project_register IS 'Project registration applications. One per contract+year (enforced by partial unique index on non-deleted records).';

-- ---------------------------------------------------------------------------
-- 3.6 project_system_item  (systems within a project registration)
-- ---------------------------------------------------------------------------
CREATE TABLE project_system_item (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_register_id BIGINT    NOT NULL,
    system_name     VARCHAR(255)  NOT NULL,
    filing_agency   VARCHAR(255)  NOT NULL,
    security_level  VARCHAR(64)   NOT NULL,
    is_reassessment BOOLEAN       NOT NULL DEFAULT FALSE,
    required_entry_date DATE      NOT NULL,
    required_report_delivery_date DATE NOT NULL,

    -- Assessed unit info
    assessed_unit_name    VARCHAR(255) NOT NULL,
    assessed_unit_industry VARCHAR(128) NOT NULL,
    assessed_unit_contact VARCHAR(64)  NOT NULL,
    assessed_unit_mobile  VARCHAR(32)  NOT NULL,
    assessed_unit_address VARCHAR(255) NOT NULL,

    -- Filing certificate
    has_filing_certificate BOOLEAN NOT NULL DEFAULT FALSE,
    filing_certificate_no  VARCHAR(128) NULL,
    filing_certificate_issued_at DATE NULL,

    -- Document flags
    has_filing_form          BOOLEAN NOT NULL DEFAULT FALSE,
    has_classification_report BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_proj_sys_project ON project_system_item (project_register_id) WHERE deleted = FALSE;

COMMENT ON TABLE project_system_item IS 'Systems registered within a project. Filing certificate and form documents are tracked via file_attachment.';

-- ---------------------------------------------------------------------------
-- 3.7 project_member  (central to visibility control)
-- ---------------------------------------------------------------------------
CREATE TABLE project_member (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT        NOT NULL,
        -- References project_register.id
    user_id         BIGINT        NOT NULL REFERENCES user_account(id),
    role_type       VARCHAR(32)   NOT NULL,
        -- PM | ASSESSOR | TECH_REVIEWER | CONTENT_REVIEWER_A |
        -- CONTENT_REVIEWER_B | CONTENT_REVIEWER_C | REPORT_WRITER
    status          VARCHAR(16)   NOT NULL DEFAULT 'ACTIVE',
        -- ACTIVE | REMOVED
    assigned_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    assigned_by     BIGINT        NOT NULL,
    removed_at      TIMESTAMPTZ   NULL,

    CONSTRAINT uk_project_member UNIQUE (project_id, user_id, role_type)
);

CREATE INDEX idx_proj_member_project ON project_member (project_id, status);
CREATE INDEX idx_proj_member_user    ON project_member (user_id, status);

COMMENT ON TABLE project_member IS 'Central project membership table. Controls visibility for on-site assessment, quality review, report compile. Replaces codex workflow_assignment + project_assessment_member.';

-- ---------------------------------------------------------------------------
-- 3.8 police_register  (public security bureau registration)
-- ---------------------------------------------------------------------------
CREATE TABLE police_register (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_register_id BIGINT    NOT NULL,
    register_no     VARCHAR(128)  NULL,
    filing_agency   VARCHAR(255)  NULL,
    contact_name    VARCHAR(64)   NULL,
    contact_phone   VARCHAR(32)   NULL,
    project_manager_id BIGINT     NULL,
        -- Selected PM for this project (also creates project_member record)
    scan_file_url   VARCHAR(512)  NULL,
    remark          TEXT          NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',

    -- Audit
    created_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_by      BIGINT        NULL,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_police_project UNIQUE (project_register_id)
);

CREATE INDEX idx_police_status ON police_register (status, updated_at);

-- ---------------------------------------------------------------------------
-- 3.9 on_site_assessment  (multi-assignee collaborative node)
-- ---------------------------------------------------------------------------
CREATE TABLE on_site_assessment (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_register_id BIGINT    NOT NULL,
    assessment_detail TEXT        NULL,
    assessment_remark TEXT        NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',
        -- DRAFT | IN_PROGRESS | SUBMITTED | QUALITY_REVIEW_STARTED

    -- Audit
    created_by      BIGINT        NOT NULL,
    updated_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_onsite_project UNIQUE (project_register_id)
);

CREATE INDEX idx_onsite_status ON on_site_assessment (status, updated_at);

COMMENT ON TABLE on_site_assessment IS 'On-site assessment header. Individual member submissions tracked via wf_task. Evidence files tracked via file_attachment.';

-- ---------------------------------------------------------------------------
-- 3.10 material_archive  (final archiving step)
-- ---------------------------------------------------------------------------
CREATE TABLE material_archive (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_register_id BIGINT    NOT NULL,
    material_status_codes JSONB   NOT NULL DEFAULT '[]',
        -- Checklist of material statuses: ["REPORT_PRINTED", "FORM_SIGNED", ...]
    file_count      INTEGER       NULL,
    storage_location VARCHAR(500) NULL,
    remark          VARCHAR(1000) NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',

    -- Audit
    submitted_by    BIGINT        NULL,
    submitted_at    TIMESTAMPTZ   NULL,
    updated_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_material_project UNIQUE (project_register_id)
);

CREATE INDEX idx_material_status ON material_archive (status, updated_at);

COMMENT ON TABLE material_archive IS 'Final material archiving. Report and form files tracked via file_attachment (biz_type=ARCHIVE).';


-- ============================================================================
-- SECTION 3.5: APPLY UPDATED_AT TRIGGERS TO ALL TABLES
-- ============================================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
        GROUP BY table_name
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;


-- ============================================================================
-- SECTION 4: SEED DATA
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 Roles (12 business roles + 1 baseline)
-- ---------------------------------------------------------------------------
INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled) VALUES
    ('super_admin',             '超级管理员',         '系统全局管理角色，拥有所有权限',             TRUE, TRUE),
    ('sales',                   '销售',               '负责客户管理和合同创建',                    TRUE, TRUE),
    ('commercial',              '商务',               '负责合同审核和归档',                        TRUE, TRUE),
    ('police_register',         '公安登记专员',        '负责公安登记操作',                         TRUE, TRUE),
    ('project_manager',         '项目经理',           '负责项目管理和现场测评组织',                 TRUE, TRUE),
    ('assessor',                '测评师',             '负责现场测评实施',                          TRUE, TRUE),
    ('tech_reviewer',           '整体技术审核员',      '负责整体技术审核',                         TRUE, TRUE),
    ('content_reviewer_tech',   '内容审核员（技术）',   '负责技术向内容审核',                       TRUE, TRUE),
    ('content_reviewer_mgmt',   '内容审核员（管理）',   '负责管理向内容审核',                       TRUE, TRUE),
    ('content_reviewer_network','内容审核员（网络）',   '负责网络向内容审核',                       TRUE, TRUE),
    ('report_writer',           '报告编制员',          '负责报告编制和提交',                       TRUE, TRUE),
    ('dept_manager',            '部门经理',           '负责报告最终审核',                          TRUE, TRUE);

-- ---------------------------------------------------------------------------
-- 4.2 Default admin user (password: admin123 — must be bcrypt hashed in app)
-- ---------------------------------------------------------------------------
-- Password: admin123 (bcrypt 10 rounds)
INSERT INTO user_account (username, password_hash, display_name, enabled, source_type)
VALUES ('admin', '$2b$10$wsfd8pq2Dxak/BqjR9dEg.PBVFoS2pHO2qVujSgdnZCWjjxWEOFXW', '管理员', TRUE, 'LOCAL');

-- Assign super_admin role to admin user
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'super_admin', 0 FROM user_account WHERE username = 'admin';

-- ---------------------------------------------------------------------------
-- 4.3 Permissions (CASL-compatible subject:action format)
-- ---------------------------------------------------------------------------
INSERT INTO iam_permission (permission_code, permission_name, category, enabled, built_in) VALUES
    -- Customer module
    ('customer:list',       '客户列表',       'CUSTOMER',   TRUE, TRUE),
    ('customer:create',     '创建客户',       'CUSTOMER',   TRUE, TRUE),
    ('customer:update',     '编辑客户',       'CUSTOMER',   TRUE, TRUE),
    ('customer:delete',     '删除客户',       'CUSTOMER',   TRUE, TRUE),

    -- Contract module
    ('contract:list',       '合同列表',       'CONTRACT',   TRUE, TRUE),
    ('contract:create',     '创建合同',       'CONTRACT',   TRUE, TRUE),
    ('contract:update',     '编辑合同',       'CONTRACT',   TRUE, TRUE),
    ('contract:delete',     '删除合同',       'CONTRACT',   TRUE, TRUE),
    ('contract:review',     '审核合同',       'CONTRACT',   TRUE, TRUE),
    ('contract:archive',    '归档合同',       'CONTRACT',   TRUE, TRUE),
    ('contract:view_all',   '查看所有合同详情', 'CONTRACT',  TRUE, TRUE),

    -- Project module
    ('project:list',        '项目列表',       'PROJECT',    TRUE, TRUE),
    ('project:create',      '创建项目登记',    'PROJECT',    TRUE, TRUE),
    ('project:update',      '编辑项目登记',    'PROJECT',    TRUE, TRUE),
    ('project:delete',      '删除项目登记',    'PROJECT',    TRUE, TRUE),
    ('project:review',      '审核项目登记',    'PROJECT',    TRUE, TRUE),
    ('project:assign_team', '分配项目组',      'PROJECT',    TRUE, TRUE),

    -- Partner module
    ('partner:list',        '合作方列表',      'PARTNER',    TRUE, TRUE),
    ('partner:create',      '创建合作方',      'PARTNER',    TRUE, TRUE),
    ('partner:update',      '编辑合作方',      'PARTNER',    TRUE, TRUE),
    ('partner:delete',      '删除合作方',      'PARTNER',    TRUE, TRUE),

    -- Police register
    ('police:operate',      '公安登记操作',    'POLICE',     TRUE, TRUE),

    -- Assessment
    ('assessment:submit',   '提交测评',       'ASSESSMENT', TRUE, TRUE),
    ('assessment:view',     '查看测评',       'ASSESSMENT', TRUE, TRUE),
    ('assessment:start_qr', '发起质量审核',    'ASSESSMENT', TRUE, TRUE),

    -- Quality review
    ('quality_review:review', '质量审核操作',  'QUALITY_REVIEW', TRUE, TRUE),

    -- Report
    ('report:assign',       '分配报告编制',    'REPORT',     TRUE, TRUE),
    ('report:compile',      '编制报告',       'REPORT',     TRUE, TRUE),
    ('report:review',       '审核报告',       'REPORT',     TRUE, TRUE),

    -- Archive
    ('archive:submit',      '提交材料归档',    'ARCHIVE',    TRUE, TRUE),

    -- Workflow task (generic)
    ('wf_task:view',        '查看待办任务',    'WORKFLOW',   TRUE, TRUE),
    ('wf_task:operate',     '操作待办任务',    'WORKFLOW',   TRUE, TRUE),

    -- System administration
    ('user:manage',         '用户管理',       'IAM',        TRUE, TRUE),
    ('role:manage',         '角色管理',       'IAM',        TRUE, TRUE),
    ('resource:manage',     '资源管理',       'IAM',        TRUE, TRUE),
    ('department:manage',   '部门管理',       'IAM',        TRUE, TRUE),
    ('workflow:manage',     '流程管理',       'IAM',        TRUE, TRUE),
    ('audit:view',          '审计日志查看',    'AUDIT',      TRUE, TRUE),
    ('recycle:manage',      '回收站管理',     'IAM',        TRUE, TRUE);

-- Super admin gets all permissions
INSERT INTO iam_role_permission (role_code, permission_code)
SELECT 'super_admin', permission_code FROM iam_permission;

-- Sales role permissions
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('sales', 'customer:list'),
    ('sales', 'customer:create'),
    ('sales', 'customer:update'),
    ('sales', 'contract:list'),
    ('sales', 'contract:create'),
    ('sales', 'contract:update'),
    ('sales', 'contract:delete'),
    ('sales', 'project:list'),
    ('sales', 'project:create'),
    ('sales', 'project:update'),
    ('sales', 'project:delete'),
    ('sales', 'partner:list'),
    ('sales', 'partner:create'),
    ('sales', 'partner:update'),
    ('sales', 'partner:delete'),
    ('sales', 'user:list'),
    ('sales', 'wf_task:view');

-- Commercial role permissions
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('commercial', 'customer:list'),
    ('commercial', 'contract:list'),
    ('commercial', 'contract:review'),
    ('commercial', 'contract:archive'),
    ('commercial', 'contract:view_all'),
    ('commercial', 'project:list'),
    ('commercial', 'wf_task:view'),
    ('commercial', 'wf_task:operate');

-- Project manager permissions
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('project_manager', 'customer:list'),
    ('project_manager', 'contract:list'),
    ('project_manager', 'project:list'),
    ('project_manager', 'assessment:submit'),
    ('project_manager', 'assessment:view'),
    ('project_manager', 'assessment:start_qr'),
    ('project_manager', 'wf_task:view'),
    ('project_manager', 'wf_task:operate');

-- Assessor permissions
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('assessor', 'customer:list'),
    ('assessor', 'project:list'),
    ('assessor', 'assessment:submit'),
    ('assessor', 'assessment:view'),
    ('assessor', 'wf_task:view'),
    ('assessor', 'wf_task:operate');

-- Police register role
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('police_register', 'customer:list'),
    ('police_register', 'project:list'),
    ('police_register', 'police:operate'),
    ('police_register', 'wf_task:view'),
    ('police_register', 'wf_task:operate');

-- Tech reviewer
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('tech_reviewer', 'customer:list'),
    ('tech_reviewer', 'project:list'),
    ('tech_reviewer', 'quality_review:review'),
    ('tech_reviewer', 'wf_task:view'),
    ('tech_reviewer', 'wf_task:operate');

-- Content reviewers (all three subtypes get same permissions)
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('content_reviewer_tech', 'customer:list'),
    ('content_reviewer_tech', 'project:list'),
    ('content_reviewer_tech', 'quality_review:review'),
    ('content_reviewer_tech', 'wf_task:view'),
    ('content_reviewer_tech', 'wf_task:operate'),

    ('content_reviewer_mgmt', 'customer:list'),
    ('content_reviewer_mgmt', 'project:list'),
    ('content_reviewer_mgmt', 'quality_review:review'),
    ('content_reviewer_mgmt', 'wf_task:view'),
    ('content_reviewer_mgmt', 'wf_task:operate'),

    ('content_reviewer_network', 'customer:list'),
    ('content_reviewer_network', 'project:list'),
    ('content_reviewer_network', 'quality_review:review'),
    ('content_reviewer_network', 'wf_task:view'),
    ('content_reviewer_network', 'wf_task:operate');

-- Report writer
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('report_writer', 'customer:list'),
    ('report_writer', 'project:list'),
    ('report_writer', 'report:compile'),
    ('report_writer', 'wf_task:view'),
    ('report_writer', 'wf_task:operate');

-- Dept manager (report final reviewer)
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    ('dept_manager', 'customer:list'),
    ('dept_manager', 'contract:list'),
    ('dept_manager', 'contract:view_all'),
    ('dept_manager', 'project:list'),
    ('dept_manager', 'project:review'),
    ('dept_manager', 'project:assign_team'),
    ('dept_manager', 'report:assign'),
    ('dept_manager', 'report:review'),
    ('dept_manager', 'archive:submit'),
    ('dept_manager', 'wf_task:view'),
    ('dept_manager', 'wf_task:operate');

-- ---------------------------------------------------------------------------
-- 4.4 Resources (frontend navigation tree)
-- ---------------------------------------------------------------------------
INSERT INTO iam_resource (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description) VALUES
    -- Top-level groups
    ('group.overview',  '总览',       'GROUP', NULL, NULL,                     'DataBoard',       10, TRUE, TRUE, '总览分组'),
    ('group.business',  '业务流程',    'GROUP', NULL, NULL,                     'OfficeBuilding',  20, TRUE, TRUE, '业务流程分组'),
    ('group.report',    '报告与归档',  'GROUP', NULL, NULL,                     'Tickets',         30, TRUE, TRUE, '报告与归档分组'),
    ('group.system',    '系统管理',    'GROUP', NULL, NULL,                     'Setting',         40, TRUE, TRUE, '系统管理分组'),

    -- Overview pages
    ('page.dashboard',  '仪表盘',     'PAGE', 'group.overview',  '/dashboard',           'DataBoard',  100, TRUE, TRUE, '系统首页'),
    ('page.workflow',   '待办审批',    'PAGE', 'group.overview',  '/workflow',            'List',       110, TRUE, TRUE, '流程审批任务中心'),

    -- Business pages
    ('page.customers',          '客户管理',     'PAGE', 'group.business', '/customers',           'User',          200, TRUE, TRUE, '客户信息维护'),
    ('page.contracts',          '合同管理',     'PAGE', 'group.business', '/contracts',           'Document',      210, TRUE, TRUE, '合同登记与归档'),
    ('page.project-registers',  '项目登记',     'PAGE', 'group.business', '/project-registers',   'Management',    220, TRUE, TRUE, '项目登记管理'),
    ('page.police-registers',   '公安登记',     'PAGE', 'group.business', '/police-registers',    'OfficeBuilding',230, TRUE, TRUE, '公安登记页面'),
    ('page.on-site-assessments','现场测评',     'PAGE', 'group.business', '/on-site-assessments', 'Connection',    240, TRUE, TRUE, '现场测评页面'),
    ('page.quality-reviews',    '质量审核',     'PAGE', 'group.business', '/quality-reviews',     'CircleCheck',   250, TRUE, TRUE, '质量审核页面'),

    -- Report pages
    ('page.report-assignments',  '编制分配',    'PAGE', 'group.report', '/report-assignments',     'Tickets',      300, TRUE, TRUE, '报告编制分配'),
    ('page.report-compile',      '报告编制',    'PAGE', 'group.report', '/report-compile',         'EditPen',      310, TRUE, TRUE, '报告编制与提交'),
    ('page.report-reviews',      '报告审核',    'PAGE', 'group.report', '/report-reviews',         'CircleCheck',  320, TRUE, TRUE, '报告终审'),
    ('page.material-archives',   '材料归档',    'PAGE', 'group.report', '/material-archives',      'FolderChecked',330, TRUE, TRUE, '材料归档'),

    -- System admin pages
    ('page.admin-users',        '用户管理',     'PAGE', 'group.system', '/admin/users',        'User',           400, TRUE, TRUE, '后台用户管理'),
    ('page.admin-roles',        '角色管理',     'PAGE', 'group.system', '/admin/roles',        'Management',     410, TRUE, TRUE, '后台角色管理'),
    ('page.admin-resources',    '资源管理',     'PAGE', 'group.system', '/admin/resources',    'Checked',        420, TRUE, TRUE, '后台资源管理'),
    ('page.admin-departments',  '部门管理',     'PAGE', 'group.system', '/admin/departments',  'OfficeBuilding', 425, TRUE, TRUE, '部门管理'),
    ('page.admin-workflow',     '流程管理',     'PAGE', 'group.system', '/admin/workflow',     'Connection',     430, TRUE, TRUE, '流程定义与节点规则'),
    ('page.admin-audit-logs',   '审计日志',     'PAGE', 'group.system', '/admin/audit-logs',   'List',           440, TRUE, TRUE, '审计日志查询'),
    ('page.recycle-bin',        '回收站',       'PAGE', 'group.system', '/admin/recycle-bin',  'Delete',         450, TRUE, TRUE, '回收站');

-- Super admin gets all resources
INSERT INTO iam_role_resource (role_code, resource_key)
SELECT 'super_admin', resource_key FROM iam_resource WHERE enabled = TRUE;

-- All roles get dashboard
INSERT INTO iam_role_resource (role_code, resource_key)
SELECT role_code, 'page.dashboard'
FROM iam_role
WHERE role_code != 'super_admin' AND enabled = TRUE;

-- Role -> resource mapping for business pages
INSERT INTO iam_role_resource (role_code, resource_key) VALUES
    -- Sales
    ('sales', 'group.overview'), ('sales', 'group.business'),
    ('sales', 'page.workflow'),
    ('sales', 'page.customers'), ('sales', 'page.contracts'),
    ('sales', 'page.project-registers'),

    -- Commercial
    ('commercial', 'group.overview'), ('commercial', 'group.business'),
    ('commercial', 'page.workflow'),
    ('commercial', 'page.customers'), ('commercial', 'page.contracts'),
    ('commercial', 'page.project-registers'),

    -- Police register
    ('police_register', 'group.overview'), ('police_register', 'group.business'),
    ('police_register', 'page.workflow'),
    ('police_register', 'page.police-registers'),

    -- Project manager
    ('project_manager', 'group.overview'), ('project_manager', 'group.business'),
    ('project_manager', 'page.workflow'),
    ('project_manager', 'page.customers'), ('project_manager', 'page.project-registers'),
    ('project_manager', 'page.on-site-assessments'),

    -- Assessor
    ('assessor', 'group.overview'), ('assessor', 'group.business'),
    ('assessor', 'page.workflow'),
    ('assessor', 'page.on-site-assessments'),

    -- Tech reviewer
    ('tech_reviewer', 'group.overview'), ('tech_reviewer', 'group.business'),
    ('tech_reviewer', 'page.workflow'),
    ('tech_reviewer', 'page.quality-reviews'),

    -- Content reviewers
    ('content_reviewer_tech', 'group.overview'), ('content_reviewer_tech', 'group.business'),
    ('content_reviewer_tech', 'page.workflow'), ('content_reviewer_tech', 'page.quality-reviews'),
    ('content_reviewer_mgmt', 'group.overview'), ('content_reviewer_mgmt', 'group.business'),
    ('content_reviewer_mgmt', 'page.workflow'), ('content_reviewer_mgmt', 'page.quality-reviews'),
    ('content_reviewer_network', 'group.overview'), ('content_reviewer_network', 'group.business'),
    ('content_reviewer_network', 'page.workflow'), ('content_reviewer_network', 'page.quality-reviews'),

    -- Report writer
    ('report_writer', 'group.overview'), ('report_writer', 'group.report'),
    ('report_writer', 'page.workflow'),
    ('report_writer', 'page.report-compile'),

    -- Dept manager
    ('dept_manager', 'group.overview'), ('dept_manager', 'group.business'), ('dept_manager', 'group.report'),
    ('dept_manager', 'page.workflow'),
    ('dept_manager', 'page.contracts'), ('dept_manager', 'page.project-registers'),
    ('dept_manager', 'page.report-assignments'), ('dept_manager', 'page.report-reviews'),
    ('dept_manager', 'page.material-archives');


-- ---------------------------------------------------------------------------
-- 4.5 Workflow Definitions — Workflow A: Contract Flow
-- ---------------------------------------------------------------------------
INSERT INTO wf_definition (def_key, version, def_name, description, status) VALUES
    ('CONTRACT_FLOW', 1, '合同流程', '合同创建 → 合同审核 → 合同归档', 'ACTIVE');

-- Contract Flow nodes
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT id, 'CONTRACT_CREATE', '合同创建', 'SIMPLE', 10, NULL
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT id, 'CONTRACT_REVIEW', '合同审核', 'REVIEW', 20,
    '{"reject_target": "CONTRACT_CREATE"}'::JSONB
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT id, 'CONTRACT_AUTO_NUMBER', '自动编号', 'AUTO', 25, '{"handler":"generateContractNo"}'::JSONB
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT id, 'CONTRACT_ARCHIVE', '合同归档', 'SIMPLE', 30, NULL
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

-- Contract Flow transitions
INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, '', 'CONTRACT_CREATE', 'AUTO', 0
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, 'CONTRACT_CREATE', 'CONTRACT_REVIEW', 'SUBMIT', 0
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, 'CONTRACT_REVIEW', 'CONTRACT_AUTO_NUMBER', 'APPROVE', 0
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, 'CONTRACT_AUTO_NUMBER', 'CONTRACT_ARCHIVE', 'AUTO', 0
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, 'CONTRACT_REVIEW', 'CONTRACT_CREATE', 'REJECT', 0
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, 'CONTRACT_ARCHIVE', '', 'SUBMIT', 0
FROM wf_definition WHERE def_key = 'CONTRACT_FLOW' AND version = 1;

-- ---------------------------------------------------------------------------
-- 4.6 Workflow Definitions — Workflow B: Project Assessment Flow
-- ---------------------------------------------------------------------------
INSERT INTO wf_definition (def_key, version, def_name, description, status) VALUES
    ('PROJECT_ASSESSMENT_FLOW', 1, '项目测评流程',
     '项目登记 → 项目审核 → 公安登记 → 现场测评 → 质量审核(4并行) → 报告分配 → 报告编制 → 报告审核 → 材料归档',
     'ACTIVE');

-- Project Assessment Flow nodes
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT id, v.node_key, v.node_name, v.node_type, v.node_order, v.config::JSONB
FROM wf_definition,
     (VALUES
        ('PROJECT_REGISTER',     '项目登记申请',   'SIMPLE',           10, NULL),
        ('PROJECT_REVIEW',       '审核项目登记',   'REVIEW',           20, '{"reject_target":"PROJECT_REGISTER"}'),
        ('POLICE_REGISTER',      '公安登记',       'SIMPLE',           30, NULL),
        ('ON_SITE_ASSESSMENT',   '现场测评实施',   'MULTI_ASSIGNEE',   40, '{"source":"project_member","role_types":["PM","ASSESSOR"]}'),
        ('QUALITY_REVIEW',       '质量审核',       'PARALLEL_REVIEW',  50, '{"slots":["TECH","CONTENT_A","CONTENT_B","CONTENT_C"]}'),
        ('REPORT_ASSIGNMENT',    '报告编制分配',   'SIMPLE',           60, NULL),
        ('REPORT_COMPILE',       '报告编制上传',   'SIMPLE',           70, NULL),
        ('REPORT_REVIEW',        '报告审核',       'REVIEW',           80, '{"reject_target":"REPORT_COMPILE"}'),
        ('MATERIAL_ARCHIVE',     '材料归档',       'SIMPLE',           90, NULL)
     ) AS v(node_key, node_name, node_type, node_order, config)
WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND version = 1;

-- Project Assessment Flow transitions
INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, v.from_key, v.to_key, v.event, 0
FROM wf_definition,
     (VALUES
        ('',                    'PROJECT_REGISTER',   'AUTO'),
        ('PROJECT_REGISTER',    'PROJECT_REVIEW',     'SUBMIT'),
        ('PROJECT_REVIEW',      'POLICE_REGISTER',    'APPROVE'),
        ('PROJECT_REVIEW',      'PROJECT_REGISTER',   'REJECT'),
        ('POLICE_REGISTER',     'ON_SITE_ASSESSMENT', 'SUBMIT'),
        ('ON_SITE_ASSESSMENT',  'QUALITY_REVIEW',     'ALL_COMPLETE'),
        ('QUALITY_REVIEW',      'REPORT_ASSIGNMENT',  'ALL_APPROVED'),
        ('QUALITY_REVIEW',      'ON_SITE_ASSESSMENT', 'ANY_REJECTED'),
        ('REPORT_ASSIGNMENT',   'REPORT_COMPILE',     'SUBMIT'),
        ('REPORT_COMPILE',      'REPORT_REVIEW',      'SUBMIT'),
        ('REPORT_REVIEW',       'MATERIAL_ARCHIVE',   'APPROVE'),
        ('REPORT_REVIEW',       'REPORT_COMPILE',     'REJECT'),
        ('MATERIAL_ARCHIVE',    '',                   'SUBMIT')
     ) AS v(from_key, to_key, event)
WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND version = 1;

-- ---------------------------------------------------------------------------
-- 4.7 Assignment Rules for Quality Review (4 parallel slots with avoidance)
-- ---------------------------------------------------------------------------
-- TECH slot: tech_reviewer role, avoid same-project members
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
    ('QUALITY_REVIEW', 'TECH',      '整体技术审核',     'tech_reviewer',           'SAME_PROJECT', 10),
    ('QUALITY_REVIEW', 'TECH',      '整体技术审核',     'super_admin',             'SAME_PROJECT', 99),

    ('QUALITY_REVIEW', 'CONTENT_A', '内容审核（技术）',  'content_reviewer_tech',   'SAME_PROJECT', 10),
    ('QUALITY_REVIEW', 'CONTENT_A', '内容审核（技术）',  'super_admin',             'SAME_PROJECT', 99),

    ('QUALITY_REVIEW', 'CONTENT_B', '内容审核（管理）',  'content_reviewer_mgmt',   'SAME_PROJECT', 10),
    ('QUALITY_REVIEW', 'CONTENT_B', '内容审核（管理）',  'super_admin',             'SAME_PROJECT', 99),

    ('QUALITY_REVIEW', 'CONTENT_C', '内容审核（网络）',  'content_reviewer_network', 'SAME_PROJECT', 10),
    ('QUALITY_REVIEW', 'CONTENT_C', '内容审核（网络）',  'super_admin',             'SAME_PROJECT', 99);

-- Report review assignment rule (dept_manager reviews)
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
    ('REPORT_REVIEW', 'REVIEWER',  '报告审核人',       'dept_manager',            'NONE',         10),
    ('REPORT_REVIEW', 'REVIEWER',  '报告审核人',       'super_admin',             'NONE',         99);

-- Contract review assignment rule
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
    ('CONTRACT_REVIEW', 'REVIEWER', '合同审核人',      'commercial',              'NONE',         10),
    ('CONTRACT_REVIEW', 'REVIEWER', '合同审核人',      'super_admin',             'NONE',         99);

-- Contract archive assignment rule
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
    ('CONTRACT_ARCHIVE', 'ARCHIVER', '合同归档人',      'commercial',              'NONE',         10),
    ('CONTRACT_ARCHIVE', 'ARCHIVER', '合同归档人',      'super_admin',             'NONE',         99);

-- Project review assignment rule
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
    ('PROJECT_REVIEW', 'REVIEWER',  '项目审核人',      'dept_manager',            'NONE',         10),
    ('PROJECT_REVIEW', 'REVIEWER',  '项目审核人',      'super_admin',             'NONE',         99);


-- ============================================================================
-- SECTION 5: DESIGN NOTES — CODEX IMPROVEMENTS
-- ============================================================================

-- What codex got right:
-- 1. Soft delete pattern with deleted_flag + deleted_at
-- 2. workflow_instance + workflow_action_log as a basic state machine
-- 3. Recycle bin with uniqueness tracking
-- 4. Field-level change audit (field_change_log)
-- 5. Resource tree for frontend menu control (iam_resource)
-- 6. Workflow node rules for auto-assignment (workflow_node_rule_item)
--
-- What we improved:
-- 1. ELIMINATED 10 per-node tables (quality_review_apply/task,
--    report_tech_review_apply/task, report_content_review_apply/task,
--    report_compile_assignment/submission, report_final_review_apply/task)
--    All replaced by wf_task with slot_key discrimination.
--
-- 2. PROPER GRAPH MODEL: codex's workflow_definition_registry was a flat
--    node list with no transitions. We have wf_definition -> wf_node ->
--    wf_transition, enabling the engine to resolve next-node automatically
--    instead of hardcoding transitions in Java service classes.
--
-- 3. FK BY ID NOT USERNAME: codex referenced users by VARCHAR username
--    everywhere (created_by, assignee, operator). Username changes would
--    break all references. We use BIGINT user IDs consistently.
--
-- 4. PARTIAL UNIQUE INDEXES: codex used (contract_id, contract_year,
--    deleted_flag) as unique key, which doesn't properly handle soft
--    deletes (what if you delete twice?). PostgreSQL partial unique index
--    WHERE deleted = FALSE handles this correctly.
--
-- 5. JSONB OVER TEXT: codex stored JSON as TEXT columns requiring
--    application-level parsing. We use native JSONB with indexing support.
--
-- 6. UNIFIED project_member: codex had workflow_assignment (4 reviewer
--    columns) + project_assessment_member (separate table). We unify into
--    project_member with role_type enum and proper lifecycle tracking.
--
-- 7. CASL-COMPATIBLE PERMISSIONS: codex's permission model evolved through
--    7 migrations with legacy code mapping. We start clean with
--    "subject:action" format matching CASL's ability definition.
--
-- 8. file_attachment CENTRALIZED: codex scattered file paths as VARCHAR
--    columns across business tables. We centralize in file_attachment
--    with polymorphic biz_type/biz_id and checksum support for offline
--    data exchange integrity.
--
-- 9. ASSIGNMENT RULE AVOIDANCE: codex hardcoded avoidance logic. We
--    make avoidance_rule a configurable field on wf_assignment_rule,
--    enabling future rule types without code changes.
--
-- 10. TIMESTAMPTZ: codex used DATETIME (MySQL, no timezone). We use
--     TIMESTAMPTZ everywhere for proper timezone-aware storage.
--
-- ============================================================================
-- EXTENSIBILITY NOTES:
--
-- Adding a new workflow (e.g., penetration testing):
-- 1. INSERT into wf_definition (new def_key)
-- 2. INSERT nodes into wf_node
-- 3. INSERT transitions into wf_transition
-- 4. INSERT assignment rules into wf_assignment_rule
-- 5. Zero code changes to workflow engine
--
-- Adding new business module:
-- 1. Create new business table
-- 2. Create wf_definition + nodes + transitions
-- 3. file_attachment supports new biz_type automatically
-- 4. field_change_log supports new biz_type automatically
-- 5. system_notification supports new ref_type automatically
--
-- Offline terminal data exchange:
-- 1. file_attachment.checksum_sha256 enables integrity verification
-- 2. wf_task.form_data JSONB stores assessment results portably
-- 3. project_member tracks who has what data for selective export
-- ============================================================================

-- ============================================================================
-- Migration: Quality Review Refactor (2026-03-31)
-- ============================================================================

-- wf_instance: add round_no for final-review reject round tracking
ALTER TABLE wf_instance ADD COLUMN IF NOT EXISTS round_no INTEGER NOT NULL DEFAULT 1;

-- review_opinion: audit trail for all review actions (approve/review/reject)
CREATE TABLE IF NOT EXISTS review_opinion (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_register_id BIGINT        NOT NULL,
    round_no            INTEGER       NOT NULL DEFAULT 1,
    node_key            VARCHAR(64)   NOT NULL,
    slot_key            VARCHAR(64),
    action_type         VARCHAR(32)   NOT NULL,
    opinion_text        TEXT,
    attachment_ids      JSONB,
    operator_id         BIGINT        NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_opinion_project ON review_opinion (project_register_id, round_no, node_key);

-- review_opinion_template: auto-fill templates per node/slot/action
CREATE TABLE IF NOT EXISTS review_opinion_template (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    node_key        VARCHAR(64)   NOT NULL,
    slot_key        VARCHAR(64),
    action_type     VARCHAR(32)   NOT NULL,
    template_text   TEXT          NOT NULL,
    sort_order      INTEGER       NOT NULL DEFAULT 0
);

-- Seed opinion templates
INSERT INTO review_opinion_template (node_key, slot_key, action_type, template_text, sort_order) VALUES
('TECH_REVIEW', NULL, 'APPROVE', '技术审核通过，符合要求', 10),
('TECH_REVIEW', NULL, 'REVIEW',  '技术审核复核，请修改后重新提交', 20),
('CONTENT_REVIEW', 'CONTENT_A', 'APPROVE', '内容（技术）审核通过，符合要求', 30),
('CONTENT_REVIEW', 'CONTENT_A', 'REVIEW',  '内容（技术）审核复核，请修改后重新提交', 40),
('CONTENT_REVIEW', 'CONTENT_B', 'APPROVE', '内容（管理）审核通过，符合要求', 50),
('CONTENT_REVIEW', 'CONTENT_B', 'REVIEW',  '内容（管理）审核复核，请修改后重新提交', 60),
('CONTENT_REVIEW', 'CONTENT_C', 'APPROVE', '内容（网络）审核通过，符合要求', 70),
('CONTENT_REVIEW', 'CONTENT_C', 'REVIEW',  '内容（网络）审核复核，请修改后重新提交', 80),
('REPORT_COMPILE', NULL, 'APPROVE', '报告编制完成，提交最终审核', 90),
('REPORT_COMPILE', NULL, 'REVIEW',  '报告编制复核，测评成果存在问题，请修改后重新提交', 100),
('FINAL_REVIEW', NULL, 'APPROVE', '最终审核通过，符合要求', 110),
('FINAL_REVIEW', NULL, 'REVIEW',  '最终审核复核，请修改后重新提交', 120),
('FINAL_REVIEW', NULL, 'REJECT',  '最终审核驳回，流程需从技术审核重新开始', 130)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 文件池表（测评文件/测评成果 + 编制报告）
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_file (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_register_id BIGINT        NOT NULL,
    file_pool           VARCHAR(32)   NOT NULL,  -- ASSESSMENT_FILE | ASSESSMENT_RESULT
    file_name           VARCHAR(500)  NOT NULL,
    object_key          VARCHAR(512)  NOT NULL,
    file_size           BIGINT        NOT NULL DEFAULT 0,
    content_type        VARCHAR(128),
    remark              VARCHAR(500),
    uploaded_by         BIGINT        NOT NULL,
    uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_assessment_file_project ON assessment_file (project_register_id, file_pool);

CREATE TABLE IF NOT EXISTS compile_report_file (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_register_id BIGINT        NOT NULL,
    file_name           VARCHAR(500)  NOT NULL,
    object_key          VARCHAR(512)  NOT NULL,
    file_size           BIGINT        NOT NULL DEFAULT 0,
    content_type        VARCHAR(128),
    remark              VARCHAR(500),
    compiled_by         BIGINT        NOT NULL,
    uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_compile_report_file_project ON compile_report_file (project_register_id);

-- ============================================================================
-- Migration: Session Changes (2026-04-01)
-- ============================================================================

-- 1. New role: report_assigner (报告分配人)
INSERT INTO iam_role (role_code, role_name, description) VALUES
('report_assigner', '报告分配人', '负责审核测评成果并分配编制任务给编制人'),
('archiver', '归档员', '负责材料归档')
ON CONFLICT (role_code) DO NOTHING;

-- 2. New permissions
INSERT INTO iam_permission (permission_code, description, category) VALUES
('archive:list', '查看归档列表', 'ARCHIVE'),
('contract:update_financial', '更新合同财务信息', 'CONTRACT')
ON CONFLICT (permission_code) DO NOTHING;

-- 3. Role-permission mappings (complete set for all roles)
-- archiver
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
('archiver', 'archive:list'), ('archiver', 'archive:submit'),
('archiver', 'contract:list'), ('archiver', 'contract:view_all'),
('archiver', 'customer:list'), ('archiver', 'project:list'),
('archiver', 'wf_task:operate'), ('archiver', 'wf_task:view')
ON CONFLICT DO NOTHING;

-- report_assigner
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
('report_assigner', 'wf_task:view'), ('report_assigner', 'wf_task:operate'),
('report_assigner', 'report:list'), ('report_assigner', 'report:view'),
('report_assigner', 'report:assign'), ('report_assigner', 'assessment:view'),
('report_assigner', 'contract:list'), ('report_assigner', 'customer:list'),
('report_assigner', 'project:list')
ON CONFLICT DO NOTHING;

-- commercial: add contract:archive
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
('commercial', 'contract:archive'), ('commercial', 'contract:update_financial')
ON CONFLICT DO NOTHING;

-- project_manager: add archive permissions
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
('project_manager', 'archive:list'), ('project_manager', 'archive:submit')
ON CONFLICT DO NOTHING;

-- sales: add archive permissions
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
('sales', 'archive:list'), ('sales', 'archive:submit')
ON CONFLICT DO NOTHING;

-- super_admin: add archive:list
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
('super_admin', 'archive:list'), ('super_admin', 'archive:submit'),
('super_admin', 'contract:archive')
ON CONFLICT DO NOTHING;

-- 4. Workflow: REPORT_ASSIGN node
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT id, 'REPORT_ASSIGN', '报告编制任务分配', 'REVIEW', 58, NULL
FROM wf_definition WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- 5. Workflow: REPORT_COMPILE change to REVIEW type
UPDATE wf_node SET node_type = 'REVIEW', config = NULL
WHERE node_key = 'REPORT_COMPILE'
AND definition_id = (SELECT id FROM wf_definition WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND status = 'ACTIVE');

-- 6. Workflow transitions updates
-- CONTENT_REVIEW ALL_APPROVED → REPORT_ASSIGN (was REPORT_COMPILE)
UPDATE wf_transition SET to_node_key = 'REPORT_ASSIGN'
WHERE from_node_key = 'CONTENT_REVIEW' AND event = 'ALL_APPROVED'
AND definition_id = (SELECT id FROM wf_definition WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND status = 'ACTIVE');

-- ON_SITE_ASSESSMENT skip path → REPORT_ASSIGN (was REPORT_COMPILE)
UPDATE wf_transition SET to_node_key = 'REPORT_ASSIGN'
WHERE from_node_key = 'ON_SITE_ASSESSMENT' AND to_node_key = 'REPORT_COMPILE'
AND definition_id = (SELECT id FROM wf_definition WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND status = 'ACTIVE');

-- REPORT_ASSIGN → REPORT_COMPILE (APPROVE)
INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, 'REPORT_ASSIGN', 'REPORT_COMPILE', 'APPROVE', 0
FROM wf_definition WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- REPORT_ASSIGN → ON_SITE_ASSESSMENT (REJECT/review fallback)
INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT id, 'REPORT_ASSIGN', 'ON_SITE_ASSESSMENT', 'REJECT', 0
FROM wf_definition WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- REPORT_COMPILE → FINAL_REVIEW (change event from SUBMIT to APPROVE)
UPDATE wf_transition SET event = 'APPROVE'
WHERE from_node_key = 'REPORT_COMPILE' AND to_node_key = 'FINAL_REVIEW'
AND definition_id = (SELECT id FROM wf_definition WHERE def_key = 'PROJECT_ASSESSMENT_FLOW' AND status = 'ACTIVE');

-- 7. Assignment rules
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, priority) VALUES
('REPORT_ASSIGN', 'ASSIGNER', '报告分配人', 'report_assigner', 10),
('REPORT_ASSIGN', 'ASSIGNER', '报告分配人', 'super_admin', 99),
('MATERIAL_ARCHIVE', 'ARCHIVER', '材料归档人', 'project_manager', 5),
('MATERIAL_ARCHIVE', 'ARCHIVER', '材料归档人', 'sales', 5)
ON CONFLICT DO NOTHING;

-- Remove archiver from CONTRACT_ARCHIVE (only commercial handles it)
DELETE FROM wf_assignment_rule WHERE node_key = 'CONTRACT_ARCHIVE' AND role_code = 'archiver';

-- 8. Opinion templates for REPORT_ASSIGN
INSERT INTO review_opinion_template (node_key, slot_key, action_type, template_text, sort_order) VALUES
('REPORT_ASSIGN', NULL, 'APPROVE', '测评成果审核通过，分配编制任务', 140),
('REPORT_ASSIGN', NULL, 'REVIEW', '测评成果存在问题，请修改后重新提交', 150)
ON CONFLICT DO NOTHING;

-- 9. Contract table: drop deprecated columns
ALTER TABLE contract DROP COLUMN IF EXISTS project_name;
ALTER TABLE contract DROP COLUMN IF EXISTS application_form_no;

-- 10. Project register: add application_no
ALTER TABLE project_register ADD COLUMN IF NOT EXISTS application_no VARCHAR(32);

-- 11. Material archive: add file_count and storage_location
ALTER TABLE material_archive ADD COLUMN IF NOT EXISTS file_count INTEGER;
ALTER TABLE material_archive ADD COLUMN IF NOT EXISTS storage_location VARCHAR(500);
