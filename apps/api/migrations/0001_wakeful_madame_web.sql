CREATE TABLE "Reference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hypothesisId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"source" text DEFAULT 'semantic_scholar' NOT NULL,
	"externalId" text NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"year" integer,
	"venue" text,
	"url" text,
	"abstract" text,
	"embedding" vector(384),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_hypothesisId_Hypothesis_id_fk" FOREIGN KEY ("hypothesisId") REFERENCES "public"."Hypothesis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_ownerId_Profile_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Reference_hypothesisId_idx" ON "Reference" USING btree ("hypothesisId");