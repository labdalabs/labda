import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// ─── GraphQL object types ────────────────────────────────────────────────────

@ObjectType()
export class Hypothesis {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field() statement!: string;
  @Field(() => String, { nullable: true }) rationale?: string | null;
  @Field() createdAt!: Date;
  @Field() updatedAt!: Date;
}

@ObjectType()
export class Project {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field(() => String, { nullable: true }) description?: string | null;
  @Field() createdAt!: Date;
  @Field() updatedAt!: Date;
  // Resolved via @ResolveField on ProjectResolver.
  @Field(() => [Hypothesis], { nullable: true })
  hypotheses?: Hypothesis[];
}

// ─── GraphQL input types ─────────────────────────────────────────────────────

@InputType()
export class CreateProjectInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

@InputType()
export class AddHypothesisInput {
  @Field(() => ID)
  @IsUUID()
  projectId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  statement!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rationale?: string;
}

// ─── Service-edge DTOs (plain shapes, no GraphQL coupling) ───────────────────

export interface ProjectDto {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HypothesisDto {
  id: string;
  projectId: string;
  statement: string;
  rationale: string | null;
  createdAt: Date;
  updatedAt: Date;
}
