import {
  Field,
  ID,
  Int,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum OkfNodeTypeGql {
  Project = 'Project',
  Hypothesis = 'Hypothesis',
  Protocol = 'Protocol',
  Reference = 'Reference',
  Notebook = 'Notebook',
  Analysis = 'Analysis',
  Thesis = 'Thesis',
  Idea = 'Idea',
  Observation = 'Observation',
  Conclusion = 'Conclusion',
  Knowledge = 'Knowledge',
  Data = 'Data',
  Paper = 'Paper',
}
registerEnumType(OkfNodeTypeGql, { name: 'OkfNodeType' });

export enum OkfPredicateGql {
  contains = 'contains',
  cites = 'cites',
  supports = 'supports',
  contradicts = 'contradicts',
  records = 'records',
  analyzes = 'analyzes',
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
  // Axial hex-grid coordinates on the board, when the node has been placed.
  @Field(() => Int, { nullable: true }) q?: number | null;
  @Field(() => Int, { nullable: true }) r?: number | null;
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
export class KnowledgeNeighbourhood {
  @Field(() => KnowledgeNode, { nullable: true }) node?: KnowledgeNode | null;
  @Field(() => [KnowledgeEdge]) edges!: KnowledgeEdge[];
  @Field(() => [KnowledgeNode]) neighbours!: KnowledgeNode[];
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

@ObjectType()
export class KnowledgeNodeType {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field(() => OkfNodeTypeGql) type!: OkfNodeTypeGql;
  @Field() title!: string;
  @Field(() => String, { nullable: true }) content?: string | null;
  @Field(() => String, { nullable: true }) sourceRef?: string | null;
  @Field() createdAt!: Date;
}

@InputType()
export class CreateKnowledgeNodeInput {
  @Field(() => ID)
  @IsUUID()
  projectId!: string;

  @Field(() => OkfNodeTypeGql)
  @IsEnum(OkfNodeTypeGql)
  type!: OkfNodeTypeGql;

  @Field()
  @IsString()
  @MaxLength(500)
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  content?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceRef?: string;
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

@InputType()
export class UpdateKnowledgeNodeInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  content?: string;
}

@InputType()
export class SetNodePositionInput {
  @Field(() => ID)
  @IsUUID()
  projectId!: string;

  @Field()
  @IsString()
  nodeId!: string;

  @Field(() => Int)
  @IsInt()
  q!: number;

  @Field(() => Int)
  @IsInt()
  r!: number;
}
