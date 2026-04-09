CREATE TABLE "registration_platform" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "registration_platform_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"platform_name" varchar(255),
	"website_url" varchar(500),
	"account" varchar(128),
	"password" varchar(255),
	"has_ca" boolean DEFAULT false NOT NULL,
	"ca_expire_date" date,
	"ca_password" varchar(255),
	"contact_name" varchar(64),
	"contact_phone" varchar(32),
	"remark" text,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
