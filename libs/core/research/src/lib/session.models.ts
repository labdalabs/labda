import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

// ─── GraphQL object types ────────────────────────────────────────────────────

// A saved EVE agent thread scoped to a Project + goal. `transcript` and
// `sessionState` cross the GraphQL boundary as JSON strings (serialized by the
// client) — no JSON scalar dependency. `transcript` defaults to "[]".
@ObjectType()
export class AgentSession {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field() goal!: string;
  @Field() transcript!: string;
  @Field(() => String, { nullable: true }) sessionState?: string | null;
  @Field() createdAt!: Date;
}

// ─── GraphQL input types ─────────────────────────────────────────────────────

@InputType()
export class CreateAgentSessionInput {
  @Field(() => ID)
  @IsUUID()
  projectId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  goal!: string;
}

@InputType()
export class SaveAgentSessionInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field()
  @IsString()
  transcript!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  sessionState?: string;
}

// ─── Service-edge DTOs (plain shapes, no GraphQL coupling) ───────────────────

export interface AgentSessionDto {
  id: string;
  projectId: string;
  goal: string;
  transcript: string;
  sessionState: string | null;
  createdAt: Date;
}
