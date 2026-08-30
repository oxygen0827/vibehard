ALTER TABLE "approvals" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "runner_nodes" ADD COLUMN "instance_id" uuid;--> statement-breakpoint
ALTER TABLE "runner_commands" ADD CONSTRAINT "runner_commands_task_id_agent_turns_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "model_profiles_provider_model_uidx" ON "model_profiles" USING btree ("provider_id","model");