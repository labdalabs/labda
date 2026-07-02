CREATE TABLE "Protocol" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"title" text NOT NULL,
	"notebook" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProtocolVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocolId" uuid NOT NULL,
	"version" integer NOT NULL,
	"notebook" jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_ownerId_Profile_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."Profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_protocolId_Protocol_id_fk" FOREIGN KEY ("protocolId") REFERENCES "public"."Protocol"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Protocol_projectId_idx" ON "Protocol" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "ProtocolVersion_protocolId_idx" ON "ProtocolVersion" USING btree ("protocolId");