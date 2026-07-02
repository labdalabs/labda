import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum OkfNodeTypeGql {
  Project = 'Project',
  Hypothesis = 'Hypothesis',
  Protocol = 'Protocol',
  Reference = 'Reference',
}
registerEnumType(OkfNodeTypeGql, { name: 'OkfNodeType' });

export enum OkfPredicateGql {
  contains = 'contains',
  cites = 'cites',
  supports = 'supports',
  contradicts = 'contradicts',
  linked = 'linked',
}
registerEnumType(OkfPredicateGql, { name: 'OkfPredicate' });

@ObjectType()
export class KnowledgeNode {
  @Field(() => ID) id!: string;
  @Field(() => OkfNodeTypeGql) type!: OkfNodeTypeGql;
  @Field() label!: string;
  // attributes as a JSON string.
  @Field() attributes!: string;
}

@ObjectType()
export class KnowledgeEdge {
  @Field(() => ID) id!: string;
  @Field(() => ID) from!: string;
  @Field(() => ID) to!: string;
  @Field(() => OkfPredicateGql) predicate!: OkfPredicateGql;
  @Field() attributes!: string;
}

@ObjectType()
export class KnowledgeGraph {
  @Field() format!: string;
  @Field(() => ID) rootId!: string;
  @Field(() => [KnowledgeNode]) nodes!: KnowledgeNode[];
  @Field(() => [KnowledgeEdge]) edges!: KnowledgeEdge[];
}

@ObjectType()
export class KnowledgeExport {
  // Signed URL to the OKF bundle index.md in Supabase Storage.
  @Field() url!: string;
  @Field() path!: string;
}

@ObjectType()
export class KnowledgeLocalExport {
  // Local directory the OKF bundle was written to (e.g. /tmp/labda/<projectId>).
  @Field() dir!: string;
  @Field(() => [String]) files!: string[];
}

@ObjectType()
export class KnowledgeLinkType {
  @Field(() => ID) id!: string;
  @Field(() => ID) fromNodeId!: string;
  @Field(() => ID) toNodeId!: string;
  @Field(() => String, { nullable: true }) label?: string | null;
}

@InputType()
export class LinkNodesInput {
  @Field(() => ID)
  @IsUUID()
  projectId!: string;

  @Field(() => ID)
  @IsString()
  fromNodeId!: string;

  @Field(() => ID)
  @IsString()
  toNodeId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
