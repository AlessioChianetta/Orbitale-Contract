CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"action" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"tax_id" text NOT NULL,
	"vat_id" text NOT NULL,
	"unique_code" text NOT NULL,
	"pec" text NOT NULL,
	"logo_url" text,
	"contract_title" text DEFAULT 'Contratto FAST TRACK VENDITE' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"predefined_bonuses" jsonb DEFAULT '[]'::jsonb,
	"payment_options" jsonb DEFAULT '{"allowInstallments":true,"maxInstallments":36,"paymentFrequencies":["monthly","quarterly","annual"]}'::jsonb,
	"created_by" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"client_data" jsonb NOT NULL,
	"generated_content" text NOT NULL,
	"pdf_path" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"contract_code" text NOT NULL,
	"total_value" integer,
	"signed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_contract_code_unique" UNIQUE("contract_code")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"phone_number" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'seller' NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
