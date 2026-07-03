CREATE TABLE "ProjectMember" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"userId" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_Profile_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember" USING btree ("projectId","userId");--> statement-breakpoint
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember" USING btree ("userId");