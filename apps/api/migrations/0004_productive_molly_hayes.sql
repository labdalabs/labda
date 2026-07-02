CREATE TABLE "KnowledgeLink" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"fromNodeId" text NOT NULL,
	"toNodeId" text NOT NULL,
	"label" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "KnowledgeLink" ADD CONSTRAINT "KnowledgeLink_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeLink" ADD CONSTRAINT "KnowledgeLink_ownerId_Profile_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "KnowledgeLink_projectId_idx" ON "KnowledgeLink" USING btree ("projectId");