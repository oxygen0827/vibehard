CREATE INDEX "agent_events_turn_sequence_idx" ON "agent_events" USING btree ("turn_id","sequence");--> statement-breakpoint
CREATE INDEX "agent_threads_project_updated_idx" ON "agent_threads" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_turns_thread_status_idx" ON "agent_turns" USING btree ("thread_id","status");--> statement-breakpoint
CREATE INDEX "approvals_turn_status_idx" ON "approvals" USING btree ("turn_id","status");--> statement-breakpoint
CREATE INDEX "projects_user_updated_idx" ON "projects" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "runner_commands_queue_idx" ON "runner_commands" USING btree ("runner_key","status","created_at");