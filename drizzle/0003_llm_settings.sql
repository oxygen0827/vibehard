CREATE TABLE "llm_settings" (
	"purpose" text PRIMARY KEY NOT NULL,
	"base_url" text NOT NULL,
	"model" text NOT NULL,
	"protocol" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"revision" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
