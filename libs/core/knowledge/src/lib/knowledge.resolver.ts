import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { KnowledgeService } from './knowledge.service';
import {
  KnowledgeExport,
  KnowledgeGraph,
  KnowledgeLinkType,
  KnowledgeLocalExport,
  LinkNodesInput,
  type OkfNodeTypeGql,
  type OkfPredicateGql,
} from './knowledge.models';
import type { OkfGraph } from './okf';

function toGql(graph: OkfGraph): KnowledgeGraph {
  return {
    format: graph.format,
    rootId: graph.rootId,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type as OkfNodeTypeGql,
      label: n.label,
      attributes: JSON.stringify(n.attributes),
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      predicate: e.predicate as OkfPredicateGql,
      attributes: JSON.stringify(e.attributes),
    })),
  };
}

@Resolver(() => KnowledgeGraph)
export class KnowledgeResolver {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Query(() => KnowledgeGraph, { name: 'knowledgeGraph' })
  async knowledgeGraph(
    @CurrentUser() user: AuthenticatedUser,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<KnowledgeGraph> {
    return toGql(await this.knowledgeService.knowledgeGraph(user, projectId));
  }

  @Mutation(() => KnowledgeExport)
  async exportKnowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<KnowledgeExport> {
    return this.knowledgeService.exportOkf(user, projectId);
  }

  @Mutation(() => KnowledgeLocalExport)
  async exportKnowledgeLocal(
    @CurrentUser() user: AuthenticatedUser,
    @Args('projectId', { type: () => ID }) projectId: string,
  ): Promise<KnowledgeLocalExport> {
    return this.knowledgeService.exportOkfLocal(user, projectId);
  }

  @Mutation(() => KnowledgeLinkType)
  async linkKnowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: LinkNodesInput,
  ): Promise<KnowledgeLinkType> {
    const row = await this.knowledgeService.linkNodes(user, input);
    return {
      id: row.id,
      fromNodeId: row.fromNodeId,
      toNodeId: row.toNodeId,
      label: row.label,
    };
  }
}
