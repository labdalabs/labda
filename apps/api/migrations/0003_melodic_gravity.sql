CREATE TABLE "Analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocolId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"name" text NOT NULL,
	"inputData" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_protocolId_Protocol_id_fk" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_ownerId_Profile_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Analysis_protocolId_idx" ON "Analysis" USING btree ("protocolId");