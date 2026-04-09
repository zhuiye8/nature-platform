CREATE TABLE "user_account" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"must_change_pwd" boolean DEFAULT false NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"avatar_url" varchar(512),
	"mobile" varchar(32),
	"email" varchar(128),
	"enabled" boolean DEFAULT true NOT NULL,
	"source_type" varchar(16) DEFAULT 'LOCAL' NOT NULL,
	"dept_id" bigint,
	"ding_user_id" varchar(64),
	"ding_union_id" varchar(128),
	"ding_job_number" varchar(64),
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_account_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "iam_department" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_department_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"dept_code" varchar(64) NOT NULL,
	"dept_name" varchar(128) NOT NULL,
	"parent_id" bigint,
	"source_type" varchar(16) DEFAULT 'LOCAL' NOT NULL,
	"ding_dept_id" varchar(64),
	"default_role_code" varchar(64),
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_department_dept_code_unique" UNIQUE("dept_code")
);
--> statement-breakpoint
CREATE TABLE "iam_permission" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_permission_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"permission_code" varchar(128) NOT NULL,
	"permission_name" varchar(128) NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" varchar(500),
	"enabled" boolean DEFAULT true NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_permission_permission_code_unique" UNIQUE("permission_code")
);
--> statement-breakpoint
CREATE TABLE "iam_role" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_role_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role_code" varchar(64) NOT NULL,
	"role_name" varchar(128) NOT NULL,
	"description" varchar(500),
	"system_flag" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_role_role_code_unique" UNIQUE("role_code")
);
--> statement-breakpoint
CREATE TABLE "iam_role_permission" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_role_permission_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role_code" varchar(64) NOT NULL,
	"permission_code" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_role_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"role_code" varchar(64) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iam_resource" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_resource_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"resource_key" varchar(128) NOT NULL,
	"resource_name" varchar(128) NOT NULL,
	"resource_type" varchar(16) NOT NULL,
	"parent_key" varchar(128),
	"route_path" varchar(255),
	"icon" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"built_in" boolean DEFAULT true NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iam_resource_resource_key_unique" UNIQUE("resource_key")
);
--> statement-breakpoint
CREATE TABLE "iam_role_resource" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iam_role_resource_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role_code" varchar(64) NOT NULL,
	"resource_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"operator_id" bigint NOT NULL,
	"action_type" varchar(64) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" varchar(128) NOT NULL,
	"detail" jsonb,
	"ip_address" varchar(45),
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_change_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "field_change_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"biz_type" varchar(64) NOT NULL,
	"biz_id" bigint NOT NULL,
	"field_name" varchar(128) NOT NULL,
	"old_value" text,
	"new_value" text,
	"operator_id" bigint NOT NULL,
	"operated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_attachment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "file_attachment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"biz_type" varchar(64) NOT NULL,
	"biz_id" bigint NOT NULL,
	"node_key" varchar(64),
	"slot_key" varchar(64),
	"file_name" varchar(256) NOT NULL,
	"file_size" bigint DEFAULT 0 NOT NULL,
	"content_type" varchar(128),
	"storage_path" varchar(512) NOT NULL,
	"checksum_sha256" varchar(64),
	"uploader_id" bigint NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recycle_bin" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recycle_bin_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"biz_type" varchar(32) NOT NULL,
	"biz_id" bigint NOT NULL,
	"display_name" varchar(500),
	"snapshot_json" jsonb,
	"deleted_by" bigint NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"remark" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "system_notification" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_notification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"receiver_id" bigint NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"read_flag" boolean DEFAULT false NOT NULL,
	"event_type" varchar(64),
	"ref_type" varchar(64),
	"ref_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wf_action_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wf_action_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"instance_id" bigint NOT NULL,
	"task_id" bigint,
	"node_key" varchar(64) NOT NULL,
	"action" varchar(32) NOT NULL,
	"from_node" varchar(64),
	"to_node" varchar(64),
	"operator_id" bigint NOT NULL,
	"remark" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wf_assignment_rule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wf_assignment_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"node_key" varchar(64) NOT NULL,
	"slot_key" varchar(64) NOT NULL,
	"slot_label" varchar(128) NOT NULL,
	"role_code" varchar(64) NOT NULL,
	"avoidance_rule" varchar(32) DEFAULT 'NONE' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wf_definition" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wf_definition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"def_key" varchar(64) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"def_name" varchar(128) NOT NULL,
	"description" varchar(500),
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wf_instance" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wf_instance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"definition_id" bigint NOT NULL,
	"biz_type" varchar(64) NOT NULL,
	"biz_id" bigint NOT NULL,
	"current_node" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'RUNNING' NOT NULL,
	"round_no" integer DEFAULT 1 NOT NULL,
	"started_by" bigint NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"variables" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wf_node" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wf_node_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"definition_id" bigint NOT NULL,
	"node_key" varchar(64) NOT NULL,
	"node_name" varchar(128) NOT NULL,
	"node_type" varchar(32) NOT NULL,
	"node_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "wf_task" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wf_task_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"instance_id" bigint NOT NULL,
	"node_key" varchar(64) NOT NULL,
	"slot_key" varchar(64),
	"assignee_id" bigint,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"result" varchar(32),
	"remark" varchar(1000),
	"form_data" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wf_transition" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wf_transition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"definition_id" bigint NOT NULL,
	"from_node_key" varchar(64) DEFAULT '' NOT NULL,
	"to_node_key" varchar(64) DEFAULT '' NOT NULL,
	"event" varchar(64) NOT NULL,
	"guard_expr" varchar(500),
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contract_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint NOT NULL,
	"contract_category" varchar(32),
	"customer_id" bigint NOT NULL,
	"contract_no" varchar(64),
	"contract_name" varchar(500),
	"contact_name" varchar(64),
	"contact_phone" varchar(32),
	"payment_company" varchar(255),
	"payment_amount" numeric(18, 2),
	"payment_method" varchar(128),
	"payment_info" text,
	"invoice_type" varchar(16),
	"tax_rate" varchar(8),
	"partner_name" varchar(255),
	"partner_id" bigint,
	"sales_person_id" bigint,
	"performance_city" varchar(64),
	"deal_status" varchar(64),
	"service_content" varchar(64),
	"contract_type" varchar(32),
	"service_years" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"service_year_detail" text,
	"payment_status" varchar(32) DEFAULT 'UNPAID' NOT NULL,
	"payment_remark" text,
	"financial_handler_id" bigint,
	"signed_at" timestamp with time zone,
	"archive_status" varchar(32) DEFAULT 'PENDING_ARCHIVE' NOT NULL,
	"file_count" integer,
	"storage_location" varchar(255),
	"archive_remark" text,
	"archived_by" bigint,
	"scan_file_url" varchar(512),
	"review_status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"remark" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contract_group" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contract_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_name" varchar(255) NOT NULL,
	"remark" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contract_serial" (
	"serial_year" integer NOT NULL,
	"service_content_code" varchar(8) NOT NULL,
	"next_seq" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_system_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contract_system_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contract_id" bigint NOT NULL,
	"system_name" varchar(255) NOT NULL,
	"system_level" smallint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"full_name" varchar(255) NOT NULL,
	"industry" varchar(128),
	"region" varchar(128),
	"address_detail" varchar(255),
	"uscc" varchar(64),
	"is_government" boolean DEFAULT false NOT NULL,
	"remark" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_contact" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_contact_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"customer_id" bigint NOT NULL,
	"contact_name" varchar(128) NOT NULL,
	"contact_phone" varchar(32),
	"position" varchar(64),
	"remark" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_archive" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "material_archive_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_register_id" bigint NOT NULL,
	"material_status_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"remark" varchar(1000),
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"file_count" integer,
	"storage_location" varchar(500),
	"submitted_by" bigint,
	"submitted_at" timestamp with time zone,
	"updated_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "on_site_assessment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "on_site_assessment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_register_id" bigint NOT NULL,
	"assessment_detail" text,
	"assessment_remark" text,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"created_by" bigint NOT NULL,
	"updated_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "partner_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"contact_name" varchar(128),
	"contact_phone" varchar(32),
	"remark" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "police_register" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "police_register_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_register_id" bigint NOT NULL,
	"register_no" varchar(128),
	"filing_agency" varchar(255),
	"contact_name" varchar(64),
	"contact_phone" varchar(32),
	"project_manager_id" bigint,
	"scan_file_url" varchar(512),
	"remark" text,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_member" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_member_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"role_type" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" bigint NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_register" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_register_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contract_id" bigint NOT NULL,
	"contract_year" integer NOT NULL,
	"application_name" varchar(500) NOT NULL,
	"application_no" varchar(32),
	"remark" text,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"compiled_by" bigint,
	"compiled_at" timestamp with time zone,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_system_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_system_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_register_id" bigint NOT NULL,
	"system_name" varchar(255) NOT NULL,
	"filing_agency" varchar(255),
	"security_level" varchar(64),
	"is_reassessment" boolean DEFAULT false NOT NULL,
	"required_entry_date" date,
	"required_report_delivery_date" date,
	"assessed_unit_name" varchar(255),
	"assessed_unit_industry" varchar(128),
	"assessed_unit_contact" varchar(64),
	"assessed_unit_mobile" varchar(32),
	"assessed_unit_address" varchar(255),
	"has_filing_certificate" boolean DEFAULT false NOT NULL,
	"filing_certificate_no" varchar(128),
	"filing_certificate_issued_at" date,
	"has_filing_form" boolean DEFAULT false NOT NULL,
	"has_classification_report" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_opinion" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_opinion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_register_id" bigint NOT NULL,
	"round_no" integer DEFAULT 1 NOT NULL,
	"node_key" varchar(64) NOT NULL,
	"slot_key" varchar(64),
	"action_type" varchar(32) NOT NULL,
	"opinion_text" text,
	"attachment_ids" jsonb,
	"operator_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_opinion_template" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_opinion_template_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"node_key" varchar(64) NOT NULL,
	"slot_key" varchar(64),
	"action_type" varchar(32) NOT NULL,
	"template_text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_file" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assessment_file_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_register_id" bigint NOT NULL,
	"file_pool" varchar(32) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"object_key" varchar(512) NOT NULL,
	"file_size" bigint DEFAULT 0 NOT NULL,
	"content_type" varchar(128),
	"remark" varchar(500),
	"uploaded_by" bigint NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "compile_report_file" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compile_report_file_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_register_id" bigint NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"object_key" varchar(512) NOT NULL,
	"file_size" bigint DEFAULT 0 NOT NULL,
	"content_type" varchar(128),
	"remark" varchar(500),
	"compiled_by" bigint NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
