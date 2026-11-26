ALTER TABLE "contracts" ADD COLUMN "sent_to_email" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "signatures" jsonb;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "auto_renewal" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "renewal_duration" integer DEFAULT 12;