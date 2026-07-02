import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// A literature search hit (not yet attached). Mirrors SemanticScholarClient's
// LiteratureHit; `externalId` + source carry provenance if attached.
@ObjectType()
export class LiteratureResult {
  @Field() externalId!: string;
  @Field() title!: string;
  @Field(() => [String]) authors!: string[];
  @Field(() => Int, { nullable: true }) year?: number | null;
  @Field(() => String, { nullable: true }) venue?: string | null;
  @Field(() => String, { nullable: true }) url?: string | null;
  @Field(() => String, { nullable: true }) abstract?: string | null;
}

@ObjectType()
export class Reference {
  @Field(() => ID) id!: string;
  @Field(() => ID) hypothesisId!: string;
  @Field() source!: string;
  @Field() externalId!: string;
  @Field() title!: string;
  @Field(() => [String]) authors!: string[];
  @Field(() => Int, { nullable: true }) year?: number | null;
  @Field(() => String, { nullable: true }) venue?: string | null;
  @Field(() => String, { nullable: true }) url?: string | null;
  @Field(() => String, { nullable: true }) abstract?: string | null;
  @Field() createdAt!: Date;
}

@InputType()
export class SearchLiteratureInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  query!: string;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

@InputType()
export class AttachReferenceInput {
  @Field(() => ID)
  @IsUUID()
  hypothesisId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @Field({ nullable: true, defaultValue: 'semantic_scholar' })
  @IsOptional()
  @IsString()
  source?: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @IsOptional()
  @IsString({ each: true })
  authors?: string[];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  year?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  venue?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  url?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  abstract?: string;
}

export interface ReferenceDto {
  id: string;
  hypothesisId: string;
  source: string;
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  abstract: string | null;
  createdAt: Date;
}

// Message enqueued on the reference.embed pgmq queue.
export interface ReferenceEmbedJob {
  referenceId: string;
}

export const REFERENCE_EMBED_QUEUE = 'reference.embed';
