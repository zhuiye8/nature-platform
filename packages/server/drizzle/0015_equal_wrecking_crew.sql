CREATE TABLE "finance_expense_request" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_expense_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contract_id" bigint NOT NULL,
	"expense_type" varchar(32) NOT NULL,
	"request_amount" numeric(18, 2) NOT NULL,
	"invoice_type" varchar(16),
	"tax_rate" varchar(8),
	"invoice_amount" numeric(18, 2),
	"payee_name" varchar(128) NOT NULL,
	"payee_bank" varchar(255) NOT NULL,
	"payee_account" varchar(64) NOT NULL,
	"partner_id" bigint,
	"partner_name" varchar(255),
	"partner_amount" numeric(18, 2),
	"partner_invoice_type" varchar(16),
	"partner_tax_rate" varchar(8),
	"remark" text,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_expense_request_status_check" CHECK ("finance_expense_request"."status" IN ('DRAFT', 'SUBMITTED', 'DEPT_APPROVED', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "finance_expense_request_system" (
	"expense_request_id" bigint NOT NULL,
	"project_system_item_id" bigint NOT NULL,
	CONSTRAINT "finance_expense_request_system_expense_request_id_project_system_item_id_pk" PRIMARY KEY("expense_request_id","project_system_item_id")
);
