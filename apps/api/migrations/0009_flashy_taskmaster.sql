CREATE TABLE "AgentSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"goal" text NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sessionState" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_ownerId_Profile_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AgentSession_projectId_idx" ON "AgentSession" USING btree ("projectId");