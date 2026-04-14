CREATE TABLE "project_system_serial" (
	"contract_id" bigint NOT NULL,
	"year_short" varchar(4) NOT NULL,
	"next_seq" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_system_serial_contract_id_year_short_pk" PRIMARY KEY("contract_id","year_short")
);
--> statement-breakpoint
ALTER TABLE "project_system_item" ADD COLUMN "system_no" varchar(128);