CREATE TYPE "public"."UserRole" AS ENUM('admin', 'member', 'viewer');--> statement-breakpoint
CREATE TABLE "Hypothesis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"statement" text NOT NULL,
	"rationale" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Profile" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"fullName" text,
	"role" "UserRole" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Hypothesis" ADD CONSTRAINT "Hypothesis_ownerId_Profile_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_Profile_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Hypothesis_projectId_idx" ON "Hypothesis" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "Project_ownerId_idx" ON "Project" USING btree ("ownerId");