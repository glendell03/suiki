CREATE TABLE "cards" (
	"card_id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"customer_address" text NOT NULL,
	"current_stamps" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"last_stamped_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "indexer_cursor" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_event_seq" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"program_id" text PRIMARY KEY NOT NULL,
	"merchant_address" text NOT NULL,
	"name" varchar(64) NOT NULL,
	"logo_url" text NOT NULL,
	"reward_description" text NOT NULL,
	"stamps_required" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"theme_id" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_program_id_programs_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("program_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_customer_program_idx" ON "cards" USING btree ("customer_address","program_id");