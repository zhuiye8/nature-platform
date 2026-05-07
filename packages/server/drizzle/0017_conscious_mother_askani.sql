CREATE TABLE "platform_serial" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_seq" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_platform" ADD COLUMN "platform_no" varchar(32);--> statement-breakpoint
ALTER TABLE "registration_platform" ADD CONSTRAINT "registration_platform_platform_no_unique" UNIQUE("platform_no");