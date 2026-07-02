import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

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
  // Signed URL to the OKF JSON in Supabase Storage.
  @Field() url!: string;
  @Field() path!: string;
}
