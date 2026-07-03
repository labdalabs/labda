import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// Cap a persisted transcript at ~4MB of JSON so a single session can't grow an
// unbounded jsonb blob.
const MAX_TRANSCRIPT = 4_000_000;

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
  @MaxLength(MAX_TRANSCRIPT)
  transcript!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TRANSCRIPT)
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
