CREATE TABLE "contract_payment_record" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contract_payment_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contract_id" bigint NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"paid_at" date NOT NULL,
	"payer" varchar(255),
	"remark" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_invoice_application" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_invoice_application_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contract_id" bigint NOT NULL,
	"invoice_content" text NOT NULL,
	"apply_amount" numeric(18, 2) NOT NULL,
	"invoice_type" varchar(16) NOT NULL,
	"tax_rate" varchar(8) NOT NULL,
	"description" text,
	"remark" text,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_invoice_application_status_check" CHECK ("finance_invoice_application"."status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "finance_invoice_application_system" (
	"invoice_application_id" bigint NOT NULL,
	"project_system_item_id" bigint NOT NULL,
	CONSTRAINT "finance_invoice_application_system_invoice_application_id_project_system_item_id_pk" PRIMARY KEY("invoice_application_id","project_system_item_id")
);
--> statement-breakpoint
ALTER TABLE "project_system_item" ADD COLUMN "amount" numeric(18, 2);