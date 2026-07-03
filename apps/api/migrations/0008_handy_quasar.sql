CREATE TABLE "NodePosition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" uuid NOT NULL,
	"nodeId" text NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "NodePosition" ADD CONSTRAINT "NodePosition_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "NodePosition_projectId_nodeId_key" ON "NodePosition" USING btree ("projectId","nodeId");