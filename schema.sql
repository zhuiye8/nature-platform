-- ============================================================================
-- DEPRECATED: 此文件仅作历史参考
-- 数据库初始化已改用: pnpm db:migrate + scripts/seed.sql
-- 详见: packages/server/drizzle/README.md
-- ============================================================================
--
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
    round_no        INTEGER       NOT NULL DEFAULT 1,
        -- Tracks final-review reject round for re-assessment cycles
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
-- 3.1 customer
-- ---------------------------------------------------------------------------
CREATE TABLE customer (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(255)  NOT NULL,
    industry        VARCHAR(128)  NULL,
    region          VARCHAR(128)  NULL,
    address_detail  VARCHAR(255)  NULL,
    uscc            VARCHAR(64)   NULL,
        -- Unified Social Credit Code (统一社会信用代码)
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

COMMENT ON TABLE customer IS 'Customer records. Contacts stored in customer_contact (one-to-many).';

-- ---------------------------------------------------------------------------
-- 3.1b customer_contact (one-to-many: customer has many contacts)
-- ---------------------------------------------------------------------------
CREATE TABLE customer_contact (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT        NOT NULL REFERENCES customer(id),
    contact_name    VARCHAR(128)  NOT NULL,
    contact_phone   VARCHAR(32)   NULL,
    position        VARCHAR(64)   NULL,
    remark          VARCHAR(500)  NULL,
    sort_order      INTEGER       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_contact_customer ON customer_contact (customer_id);

COMMENT ON TABLE customer_contact IS 'Customer contacts (one-to-many). First by sort_order is the primary contact.';

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
-- 3.3a contract_group
-- ---------------------------------------------------------------------------
CREATE TABLE contract_group (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_name      VARCHAR(255)  NOT NULL,
    remark          TEXT          NULL,

    created_by      BIGINT        NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_by      BIGINT        NULL,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ   NULL
);

CREATE INDEX idx_contract_group_deleted ON contract_group (deleted) WHERE deleted = FALSE;
CREATE INDEX idx_contract_group_creator ON contract_group (created_by);

COMMENT ON TABLE contract_group IS 'Contract groups — groups related contracts (委托书/收款合同/付款合同) for the same bid project.';

-- ---------------------------------------------------------------------------
-- 3.3b contract
-- ---------------------------------------------------------------------------
CREATE TABLE contract (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id        BIGINT        NOT NULL REFERENCES contract_group(id),
    contract_category VARCHAR(32) NULL,
        -- 委托书 | 收款合同 | 付款合同
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
    payment_amount  DECIMAL(18,2) NULL,
    payment_method  VARCHAR(128)  NULL,
    payment_info    TEXT          NULL,
    invoice_type    VARCHAR(16)   NULL,
        -- 专票 | 普票
    tax_rate        VARCHAR(8)    NULL,
        -- 0 | 1 | 3 | 6 | 9 | 13
    partner_name    VARCHAR(255)  NULL,
    partner_id      BIGINT        NULL,
    sales_person_id BIGINT        NULL,
    performance_city VARCHAR(64)  NULL,
    deal_status     VARCHAR(64)   NULL,
    service_content VARCHAR(64)   NULL,
        -- 等级保护测评 | 安全咨询 | 渗透测试 | 风险评估 | 其他
    contract_type   VARCHAR(32)   NULL,
        -- 自主 | 直接合作 | 间接合作
    service_years   JSONB         NOT NULL DEFAULT '[]',
        -- Array of years: [2026, 2027, 2028]
    service_year_detail TEXT      NULL,

    -- Financial
    payment_status  VARCHAR(32)   NOT NULL DEFAULT 'UNPAID',
    payment_remark  TEXT          NULL,
    financial_handler_id BIGINT   NULL,
        -- Last finance user who edited payment status
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
    serial_year         INT           NOT NULL,
    service_content_code VARCHAR(8)   NOT NULL,
    next_seq            INT           NOT NULL DEFAULT 1,
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (serial_year, service_content_code)
);

COMMENT ON TABLE contract_serial IS 'Per service-content yearly sequence for contract numbers. Format: YZDZR-{code}-{yy}-{seq:04d}.';

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
    filing_agency   VARCHAR(255)  NULL,
    security_level  VARCHAR(64)   NULL,
    is_reassessment BOOLEAN       NOT NULL DEFAULT FALSE,
    required_entry_date DATE      NULL,
    required_report_delivery_date DATE NULL,

    -- Assessed unit info
    assessed_unit_name    VARCHAR(255) NULL,
    assessed_unit_industry VARCHAR(128) NULL,
    assessed_unit_contact VARCHAR(64)  NULL,
    assessed_unit_mobile  VARCHAR(32)  NULL,
    assessed_unit_address VARCHAR(255) NULL,

    -- Filing certificate
    has_filing_certificate BOOLEAN NOT NULL DEFAULT FALSE,
    filing_certificate_no  VARCHAR(128) NULL,
    filing_certificate_issued_at DATE NULL,

    -- Document flags
    has_filing_form          BOOLEAN NOT NULL DEFAULT FALSE,
    has_classification_report BOOLEAN NOT NULL DEFAULT FALSE,

    sort_order      INT           NOT NULL DEFAULT 0,

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


-- ---------------------------------------------------------------------------
-- Review opinions (quality review audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE review_opinion (
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
CREATE INDEX idx_review_opinion_project ON review_opinion (project_register_id, round_no, node_key);

CREATE TABLE review_opinion_template (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    node_key        VARCHAR(64)   NOT NULL,
    slot_key        VARCHAR(64),
    action_type     VARCHAR(32)   NOT NULL,
    template_text   TEXT          NOT NULL,
    sort_order      INTEGER       NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- File pools (assessment files + compile report files)
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_file (
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
CREATE INDEX idx_assessment_file_project ON assessment_file (project_register_id, file_pool);

CREATE TABLE compile_report_file (
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
CREATE INDEX idx_compile_report_file_project ON compile_report_file (project_register_id);


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
-- 4.1 Roles (14 business roles)
-- ---------------------------------------------------------------------------
INSERT INTO iam_role (role_code, role_name, description, enabled, system_flag) VALUES
    ('super_admin',              '超级管理员',           '系统全局管理角色，拥有所有权限',              TRUE, TRUE),
    ('sales',                    '销售',                '负责客户管理和合同创建',                     TRUE, TRUE),
    ('commercial',               '商务',                '负责合同归档',                               TRUE, TRUE),
    ('dept_manager',             '部门经理',            '负责合同审核、项目审核、最终审核',            TRUE, TRUE),
    ('project_manager',          '项目经理',            '负责项目管理和现场测评组织',                  TRUE, TRUE),
    ('assessor',                 '测评师',              '负责现场测评实施',                           TRUE, TRUE),
    ('police_register',          '公安登记专员',         '负责公安登记操作',                          TRUE, TRUE),
    ('tech_reviewer',            '整体技术审核员',       '负责整体技术审核',                          TRUE, TRUE),
    ('content_reviewer_tech',    '内容审核员（技术）',   '负责技术向内容审核',                        TRUE, TRUE),
    ('content_reviewer_mgmt',    '内容审核员（管理）',   '负责管理向内容审核',                        TRUE, TRUE),
    ('content_reviewer_network', '内容审核员（网络）',   '负责网络向内容审核',                        TRUE, TRUE),
    ('report_writer',            '报告编制员',          '负责报告编制和提交',                         TRUE, TRUE),
    ('report_assigner',          '报告分配人',          '负责审核测评成果并分配编制任务给编制人',       TRUE, TRUE),
    ('archiver',                 '归档员',              '负责材料归档',                               TRUE, TRUE),
    ('project_director',         '项目主管',            '负责项目登记审核、分配项目经理和测评师',       TRUE, TRUE),
    ('finance',                  '财务',                '负责合同回款管理',                           TRUE, TRUE);

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
    ('police:list',         '公安登记列表',    'POLICE',     TRUE, TRUE),
    ('police:create',       '创建公安登记',    'POLICE',     TRUE, TRUE),
    ('police:update',       '编辑公安登记',    'POLICE',     TRUE, TRUE),
    ('police:complete',     '完成公安登记',    'POLICE',     TRUE, TRUE),
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
    ('report:list',         '报告列表',       'REPORT',     TRUE, TRUE),
    ('report:review',       '审核报告',       'REPORT',     TRUE, TRUE),
    ('report:submit',       '提交报告',       'REPORT',     TRUE, TRUE),
    ('report:view',         '查看报告',       'REPORT',     TRUE, TRUE),

    -- Archive
    ('archive:list',        '归档列表',       'ARCHIVE',    TRUE, TRUE),
    ('archive:submit',      '提交材料归档',    'ARCHIVE',    TRUE, TRUE),

    -- Workflow task (generic)
    ('wf_task:view',        '查看待办任务',    'WORKFLOW',   TRUE, TRUE),
    ('wf_task:operate',     '操作待办任务',    'WORKFLOW',   TRUE, TRUE),

    -- Contract financial
    ('contract:update_financial', '更新合同财务信息', 'CONTRACT', TRUE, TRUE),

    -- System administration
    ('user:list',           '用户列表',       'IAM',        TRUE, TRUE),
    ('user:create',         '创建用户',       'IAM',        TRUE, TRUE),
    ('user:update',         '编辑用户',       'IAM',        TRUE, TRUE),
    ('user:delete',         '删除用户',       'IAM',        TRUE, TRUE),
    ('user:manage',         '用户管理',       'IAM',        TRUE, TRUE),
    ('role:list',           '角色列表',       'IAM',        TRUE, TRUE),
    ('role:create',         '创建角色',       'IAM',        TRUE, TRUE),
    ('role:update',         '编辑角色',       'IAM',        TRUE, TRUE),
    ('role:delete',         '删除角色',       'IAM',        TRUE, TRUE),
    ('role:manage',         '角色管理',       'IAM',        TRUE, TRUE),
    ('resource:manage',     '资源管理',       'IAM',        TRUE, TRUE),
    ('department:manage',   '部门管理',       'IAM',        TRUE, TRUE),
    ('workflow:manage',     '流程管理',       'IAM',        TRUE, TRUE),
    ('audit:view',          '审计日志查看',    'AUDIT',      TRUE, TRUE),
    ('recycle:list',        '回收站列表',     'IAM',        TRUE, TRUE),
    ('recycle:restore',     '回收站恢复',     'IAM',        TRUE, TRUE),
    ('recycle:delete',      '回收站删除',     'IAM',        TRUE, TRUE),
    ('recycle:manage',      '回收站管理',     'IAM',        TRUE, TRUE);

INSERT INTO iam_role_permission (role_code, permission_code) VALUES
    -- super_admin: all permissions
    ('super_admin', 'customer:list'), ('super_admin', 'customer:create'), ('super_admin', 'customer:update'), ('super_admin', 'customer:delete'),
    ('super_admin', 'contract:list'), ('super_admin', 'contract:create'), ('super_admin', 'contract:update'), ('super_admin', 'contract:delete'),
    ('super_admin', 'contract:review'), ('super_admin', 'contract:archive'), ('super_admin', 'contract:view_all'),
    ('super_admin', 'partner:list'), ('super_admin', 'partner:create'), ('super_admin', 'partner:update'), ('super_admin', 'partner:delete'),
    ('super_admin', 'project:list'), ('super_admin', 'project:create'), ('super_admin', 'project:update'), ('super_admin', 'project:delete'),
    ('super_admin', 'project:review'), ('super_admin', 'project:assign_team'),
    ('super_admin', 'police:list'), ('super_admin', 'police:create'), ('super_admin', 'police:update'), ('super_admin', 'police:complete'), ('super_admin', 'police:operate'),
    ('super_admin', 'assessment:submit'), ('super_admin', 'assessment:view'), ('super_admin', 'assessment:start_qr'),
    ('super_admin', 'quality_review:review'),
    ('super_admin', 'report:assign'), ('super_admin', 'report:compile'), ('super_admin', 'report:list'), ('super_admin', 'report:review'), ('super_admin', 'report:submit'), ('super_admin', 'report:view'),
    ('super_admin', 'archive:list'), ('super_admin', 'archive:submit'),
    ('super_admin', 'user:list'), ('super_admin', 'user:create'), ('super_admin', 'user:update'), ('super_admin', 'user:delete'), ('super_admin', 'user:manage'),
    ('super_admin', 'role:list'), ('super_admin', 'role:create'), ('super_admin', 'role:update'), ('super_admin', 'role:delete'), ('super_admin', 'role:manage'),
    ('super_admin', 'resource:manage'), ('super_admin', 'department:manage'), ('super_admin', 'workflow:manage'),
    ('super_admin', 'audit:view'),
    ('super_admin', 'recycle:list'), ('super_admin', 'recycle:restore'), ('super_admin', 'recycle:delete'), ('super_admin', 'recycle:manage'),
    ('super_admin', 'wf_task:view'), ('super_admin', 'wf_task:operate'),

    -- sales
    ('sales', 'customer:list'), ('sales', 'customer:create'), ('sales', 'customer:update'),
    ('sales', 'contract:list'), ('sales', 'contract:create'), ('sales', 'contract:update'), ('sales', 'contract:delete'),
    ('sales', 'partner:list'), ('sales', 'partner:create'), ('sales', 'partner:update'), ('sales', 'partner:delete'),
    ('sales', 'project:list'), ('sales', 'project:create'), ('sales', 'project:update'), ('sales', 'project:delete'),
    ('sales', 'archive:list'), ('sales', 'archive:submit'),
    ('sales', 'user:list'), ('sales', 'wf_task:view'),

    -- commercial
    ('commercial', 'customer:list'),
    ('commercial', 'contract:list'), ('commercial', 'contract:archive'), ('commercial', 'contract:view_all'),
    ('commercial', 'contract:update'),
    ('commercial', 'project:list'),
    ('commercial', 'wf_task:view'), ('commercial', 'wf_task:operate'),

    -- dept_manager
    ('dept_manager', 'customer:list'),
    ('dept_manager', 'contract:list'), ('dept_manager', 'contract:view_all'),
    ('dept_manager', 'project:list'), ('dept_manager', 'project:review'), ('dept_manager', 'project:assign_team'),
    ('dept_manager', 'assessment:view'),
    ('dept_manager', 'report:assign'), ('dept_manager', 'report:list'), ('dept_manager', 'report:view'), ('dept_manager', 'report:review'),
    ('dept_manager', 'archive:list'), ('dept_manager', 'archive:submit'),
    ('dept_manager', 'user:list'),
    ('dept_manager', 'wf_task:view'), ('dept_manager', 'wf_task:operate'),

    -- project_manager
    ('project_manager', 'customer:list'), ('project_manager', 'contract:list'), ('project_manager', 'project:list'),
    ('project_manager', 'assessment:submit'), ('project_manager', 'assessment:view'), ('project_manager', 'assessment:start_qr'),
    ('project_manager', 'report:assign'), ('project_manager', 'report:list'), ('project_manager', 'report:view'),
    ('project_manager', 'archive:list'), ('project_manager', 'archive:submit'),
    ('project_manager', 'wf_task:view'), ('project_manager', 'wf_task:operate'),

    -- assessor
    ('assessor', 'customer:list'), ('assessor', 'contract:list'), ('assessor', 'project:list'),
    ('assessor', 'assessment:submit'), ('assessor', 'assessment:view'),
    ('assessor', 'report:list'), ('assessor', 'report:view'),
    ('assessor', 'wf_task:view'), ('assessor', 'wf_task:operate'),

    -- police_register
    ('police_register', 'customer:list'), ('police_register', 'contract:list'), ('police_register', 'project:list'),
    ('police_register', 'police:list'), ('police_register', 'police:create'), ('police_register', 'police:update'),
    ('police_register', 'police:complete'), ('police_register', 'police:operate'),
    ('police_register', 'wf_task:view'), ('police_register', 'wf_task:operate'),

    -- tech_reviewer
    ('tech_reviewer', 'customer:list'), ('tech_reviewer', 'contract:list'), ('tech_reviewer', 'project:list'),
    ('tech_reviewer', 'quality_review:review'),
    ('tech_reviewer', 'report:list'), ('tech_reviewer', 'report:view'),
    ('tech_reviewer', 'wf_task:view'), ('tech_reviewer', 'wf_task:operate'),

    -- content_reviewer_tech
    ('content_reviewer_tech', 'customer:list'), ('content_reviewer_tech', 'contract:list'), ('content_reviewer_tech', 'project:list'),
    ('content_reviewer_tech', 'quality_review:review'),
    ('content_reviewer_tech', 'wf_task:view'), ('content_reviewer_tech', 'wf_task:operate'),

    -- content_reviewer_mgmt
    ('content_reviewer_mgmt', 'customer:list'), ('content_reviewer_mgmt', 'contract:list'), ('content_reviewer_mgmt', 'project:list'),
    ('content_reviewer_mgmt', 'quality_review:review'), ('content_reviewer_mgmt', 'assessment:view'),
    ('content_reviewer_mgmt', 'wf_task:view'), ('content_reviewer_mgmt', 'wf_task:operate'),

    -- content_reviewer_network
    ('content_reviewer_network', 'customer:list'), ('content_reviewer_network', 'contract:list'), ('content_reviewer_network', 'project:list'),
    ('content_reviewer_network', 'quality_review:review'), ('content_reviewer_network', 'assessment:view'),
    ('content_reviewer_network', 'wf_task:view'), ('content_reviewer_network', 'wf_task:operate'),

    -- report_writer
    ('report_writer', 'customer:list'), ('report_writer', 'contract:list'), ('report_writer', 'project:list'),
    ('report_writer', 'assessment:view'),
    ('report_writer', 'report:compile'), ('report_writer', 'report:list'), ('report_writer', 'report:submit'), ('report_writer', 'report:view'),
    ('report_writer', 'wf_task:view'), ('report_writer', 'wf_task:operate'),

    -- report_assigner
    ('report_assigner', 'customer:list'), ('report_assigner', 'contract:list'), ('report_assigner', 'project:list'),
    ('report_assigner', 'assessment:view'),
    ('report_assigner', 'report:assign'), ('report_assigner', 'report:list'), ('report_assigner', 'report:view'),
    ('report_assigner', 'wf_task:view'), ('report_assigner', 'wf_task:operate'),

    -- archiver
    ('archiver', 'customer:list'), ('archiver', 'contract:list'), ('archiver', 'contract:view_all'), ('archiver', 'project:list'),
    ('archiver', 'archive:list'), ('archiver', 'archive:submit'),
    ('archiver', 'wf_task:view'), ('archiver', 'wf_task:operate'),

    -- project_director
    ('project_director', 'customer:list'), ('project_director', 'contract:list'),
    ('project_director', 'project:list'), ('project_director', 'project:review'), ('project_director', 'project:assign_team'),
    ('project_director', 'wf_task:view'), ('project_director', 'wf_task:operate'),

    -- finance
    ('finance', 'contract:list'), ('finance', 'contract:update_financial'),
    ('finance', 'wf_task:view');

-- ---------------------------------------------------------------------------
-- 4.4 Resources (frontend navigation tree)
-- ---------------------------------------------------------------------------
INSERT INTO iam_resource (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description) VALUES
    -- Top-level groups
    ('group.overview',  '总览',       'GROUP', NULL, NULL,                     'DataBoard',       10, TRUE, TRUE, '总览分组'),
    ('group.business',  '业务流程',    'GROUP', NULL, NULL,                     'OfficeBuilding',  20, TRUE, TRUE, '业务流程分组'),
    ('group.report',    '报告与归档',  'GROUP', NULL, NULL,                     'Tickets',         30, TRUE, TRUE, '报告与归档分组'),
    ('group.finance',   '财务管理',    'GROUP', NULL, NULL,                     'Money',           35, TRUE, TRUE, '财务管理分组'),
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

    -- Finance pages
    ('page.contract-finance',    '合同财务',    'PAGE', 'group.finance', '/finance/contract',       'Money',        350, TRUE, TRUE, '合同回款管理'),

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
    ('dept_manager', 'page.material-archives'),

    -- Project director
    ('project_director', 'group.overview'), ('project_director', 'group.business'),
    ('project_director', 'page.workflow'),
    ('project_director', 'page.customers'), ('project_director', 'page.contracts'),
    ('project_director', 'page.project-registers'),

    -- Finance
    ('finance', 'group.overview'), ('finance', 'group.finance'),
    ('finance', 'page.workflow'),
    ('finance', 'page.contract-finance');


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
SELECT id, 'CONTRACT_ARCHIVE', '合同归档', 'SIMPLE', 30, '{"assignMode": "pool"}'::JSONB
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
SELECT d.id, v.node_key, v.node_name, v.node_type, v.node_order, v.config::JSONB
FROM wf_definition d,
(VALUES
    ('PROJECT_REGISTER',   '项目登记申请',     'SIMPLE',          10, NULL),
    ('PROJECT_REVIEW',     '审核项目登记',     'REVIEW',          20, '{"reject_target":"PROJECT_REGISTER"}'),
    ('POLICE_REGISTER',    '公安登记',         'SIMPLE',          30, '{"assignMode":"pool"}'),
    ('ON_SITE_ASSESSMENT', '现场测评实施',     'MULTI_ASSIGNEE',  40, '{"source":"project_member","role_types":["PM","ASSESSOR"]}'),
    ('TECH_REVIEW',        '技术审核',         'REVIEW',          50, '{"reject_target":"ON_SITE_ASSESSMENT"}'),
    ('CONTENT_REVIEW',     '内容审核',         'PARALLEL_REVIEW', 55, '{"slots":["CONTENT_A","CONTENT_B","CONTENT_C"]}'),
    ('REPORT_ASSIGN',      '报告编制任务分配', 'REVIEW',          58, NULL),
    ('REPORT_COMPILE',     '报告编制上传',     'REVIEW',          60, NULL),
    ('FINAL_REVIEW',       '最终审核',         'REVIEW',          70, '{"reject_action":"ADJUST","reject_target":"ON_SITE_ASSESSMENT"}'),
    ('MATERIAL_ARCHIVE',   '材料归档',         'SIMPLE',          90, '{"assignMode":"pool"}')
) AS v(node_key, node_name, node_type, node_order, config)
WHERE d.def_key = 'PROJECT_ASSESSMENT_FLOW' AND d.status = 'ACTIVE';

-- Project Assessment Flow transitions
INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, guard_expr, priority)
SELECT d.id, v.from_key, v.to_key, v.event, v.guard, v.priority
FROM wf_definition d,
(VALUES
    ('',                   'PROJECT_REGISTER',   'AUTO',         NULL, 0),
    ('PROJECT_REGISTER',   'PROJECT_REVIEW',     'SUBMIT',       NULL, 0),
    ('PROJECT_REVIEW',     'POLICE_REGISTER',    'APPROVE',      NULL, 0),
    ('PROJECT_REVIEW',     'PROJECT_REGISTER',   'REJECT',       NULL, 0),
    ('POLICE_REGISTER',    'ON_SITE_ASSESSMENT', 'SUBMIT',       NULL, 0),
    ('ON_SITE_ASSESSMENT', 'TECH_REVIEW',        'ALL_COMPLETE', NULL, 0),
    ('ON_SITE_ASSESSMENT', 'REPORT_ASSIGN',      'ALL_COMPLETE', 'skip_to_final', 10),
    ('TECH_REVIEW',        'CONTENT_REVIEW',     'APPROVE',      NULL, 0),
    ('TECH_REVIEW',        'ON_SITE_ASSESSMENT', 'REJECT',       NULL, 0),
    ('CONTENT_REVIEW',     'REPORT_ASSIGN',      'ALL_APPROVED', NULL, 0),
    ('CONTENT_REVIEW',     'ON_SITE_ASSESSMENT', 'ANY_REJECTED', NULL, 0),
    ('REPORT_ASSIGN',      'REPORT_COMPILE',     'APPROVE',      NULL, 0),
    ('REPORT_ASSIGN',      'ON_SITE_ASSESSMENT', 'REJECT',       NULL, 0),
    ('REPORT_COMPILE',     'FINAL_REVIEW',       'APPROVE',      NULL, 0),
    ('FINAL_REVIEW',       'MATERIAL_ARCHIVE',   'APPROVE',      NULL, 0),
    ('FINAL_REVIEW',       'ON_SITE_ASSESSMENT', 'ADJUST',       NULL, 0),
    ('MATERIAL_ARCHIVE',   '',                   'SUBMIT',       NULL, 0)
) AS v(from_key, to_key, event, guard, priority)
WHERE d.def_key = 'PROJECT_ASSESSMENT_FLOW' AND d.status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- 4.7 Assignment Rules
-- ---------------------------------------------------------------------------
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
    -- Contract
    ('CONTRACT_REVIEW',  'REVIEWER',  '合同审核人',       'dept_manager',            'NONE',         5),
    ('CONTRACT_REVIEW',  'REVIEWER',  '合同审核人',       'super_admin',             'NONE',         99),
    ('CONTRACT_ARCHIVE', 'ARCHIVER',  '合同归档人',       'commercial',              'NONE',         10),
    ('CONTRACT_ARCHIVE', 'ARCHIVER',  '合同归档人',       'super_admin',             'NONE',         99),
    -- Project
    ('PROJECT_REVIEW',   'REVIEWER',  '项目审核人',       'project_director',        'NONE',         10),
    ('PROJECT_REVIEW',   'REVIEWER',  '项目审核人',       'super_admin',             'NONE',         99),
    ('POLICE_REGISTER',  'OPERATOR',  '公安登记人',       'police_register',         'NONE',         10),
    ('POLICE_REGISTER',  'OPERATOR',  '公安登记人',       'super_admin',             'NONE',         99),
    -- Quality Review
    ('TECH_REVIEW',      'TECH',      '技术审核',         'tech_reviewer',           'SAME_PROJECT', 10),
    ('TECH_REVIEW',      'TECH',      '技术审核',         'super_admin',             'SAME_PROJECT', 99),
    ('CONTENT_REVIEW',   'CONTENT_A', '内容审核（技术）', 'content_reviewer_tech',   'SAME_PROJECT', 10),
    ('CONTENT_REVIEW',   'CONTENT_A', '内容审核（技术）', 'super_admin',             'SAME_PROJECT', 99),
    ('CONTENT_REVIEW',   'CONTENT_B', '内容审核（管理）', 'content_reviewer_mgmt',   'SAME_PROJECT', 10),
    ('CONTENT_REVIEW',   'CONTENT_B', '内容审核（管理）', 'super_admin',             'SAME_PROJECT', 99),
    ('CONTENT_REVIEW',   'CONTENT_C', '内容审核（网络）', 'content_reviewer_network','SAME_PROJECT', 10),
    ('CONTENT_REVIEW',   'CONTENT_C', '内容审核（网络）', 'super_admin',             'SAME_PROJECT', 99),
    -- Report
    ('REPORT_ASSIGN',    'ASSIGNER',  '报告分配人',       'report_assigner',         'NONE',         10),
    ('REPORT_ASSIGN',    'ASSIGNER',  '报告分配人',       'super_admin',             'NONE',         99),
    ('REPORT_COMPILE',   'WRITER',    '报告编制人',       'report_writer',           'NONE',         10),
    ('REPORT_COMPILE',   'WRITER',    '报告编制人',       'super_admin',             'NONE',         99),
    ('FINAL_REVIEW',     'REVIEWER',  '最终审核人',       'dept_manager',            'NONE',         10),
    ('FINAL_REVIEW',     'REVIEWER',  '最终审核人',       'super_admin',             'NONE',         99),
    -- Material Archive
    ('MATERIAL_ARCHIVE', 'ARCHIVER',  '材料归档人',       'archiver',                'NONE',         10),
    ('MATERIAL_ARCHIVE', 'ARCHIVER',  '材料归档人',       'project_manager',         'NONE',         5),
    ('MATERIAL_ARCHIVE', 'ARCHIVER',  '材料归档人',       'sales',                   'NONE',         5),
    ('MATERIAL_ARCHIVE', 'ARCHIVER',  '材料归档人',       'dept_manager',            'NONE',         5),
    ('MATERIAL_ARCHIVE', 'ARCHIVER',  '材料归档人',       'super_admin',             'NONE',         0);

-- ---------------------------------------------------------------------------
-- Review opinion templates
-- ---------------------------------------------------------------------------
INSERT INTO review_opinion_template (node_key, slot_key, action_type, template_text, sort_order) VALUES
    ('TECH_REVIEW',    NULL,        'APPROVE', '技术审核通过，符合要求',                              10),
    ('TECH_REVIEW',    NULL,        'REVIEW',  '技术审核复核，请修改后重新提交',                      20),
    ('CONTENT_REVIEW', 'CONTENT_A', 'APPROVE', '内容（技术）审核通过，符合要求',                      30),
    ('CONTENT_REVIEW', 'CONTENT_A', 'REVIEW',  '内容（技术）审核复核，请修改后重新提交',              40),
    ('CONTENT_REVIEW', 'CONTENT_B', 'APPROVE', '内容（管理）审核通过，符合要求',                      50),
    ('CONTENT_REVIEW', 'CONTENT_B', 'REVIEW',  '内容（管理）审核复核，请修改后重新提交',              60),
    ('CONTENT_REVIEW', 'CONTENT_C', 'APPROVE', '内容（网络）审核通过，符合要求',                      70),
    ('CONTENT_REVIEW', 'CONTENT_C', 'REVIEW',  '内容（网络）审核复核，请修改后重新提交',              80),
    ('REPORT_COMPILE', NULL,        'APPROVE', '报告编制完成，提交最终审核',                          90),
    ('REPORT_COMPILE', NULL,        'REVIEW',  '报告编制复核，测评成果存在问题，请修改后重新提交',    100),
    ('FINAL_REVIEW',   NULL,        'APPROVE', '最终审核通过，符合要求',                             110),
    ('FINAL_REVIEW',   NULL,        'REVIEW',  '最终审核复核，请修改后重新提交',                     120),
    ('FINAL_REVIEW',   NULL,        'REJECT',  '最终审核驳回，流程需从技术审核重新开始',             130),
    ('REPORT_ASSIGN',  NULL,        'APPROVE', '测评成果审核通过，分配编制任务',                     140),
    ('REPORT_ASSIGN',  NULL,        'REVIEW',  '测评成果存在问题，请修改后重新提交',                 150);


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

