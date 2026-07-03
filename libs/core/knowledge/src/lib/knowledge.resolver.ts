import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { KnowledgeService } from './knowledge.service';
import {
  CreateKnowledgeNodeInput,
  KnowledgeExport,
  KnowledgeGraph,
  KnowledgeLinkType,
  KnowledgeLocalExport,
  KnowledgeNeighbourhood,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  LinkNodesInput,
  type OkfNodeTypeGql,
  type OkfPredicateGql,
} from './knowledge.models';
import { neighbours } from './okf';
import type { OkfEdge, OkfGraph, OkfNode, OkfNodeType } from './okf';

function nodeToGql(n: OkfNode): KnowledgeNode {
  return {
    id: n.id,
    type: n.type as OkfNodeTypeGql,
    label: n.label,
    attributes: JSON.stringify(n.attributes),
  };
}

function edgeToGql(e: OkfEdge): KnowledgeEdge {
  return {
    id: e.id,
    from: e.from,
    to: e.to,
    predicate: e.predicate as OkfPredicateGql,
    attributes: JSON.stringify(e.attributes),
  };
}

function toGql(graph: OkfGraph): KnowledgeGraph {
  return {
    format: graph.format,
    rootId: graph.rootId,
    nodes: graph.nodes.map(nodeToGql),
    edges: graph.edges.map(edgeToGql),
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

  @Query(() => KnowledgeNeighbourhood)
  async knowledgeNeighbours(
    @CurrentUser() user: AuthenticatedUser,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('nodeId') nodeId: string,
  ): Promise<KnowledgeNeighbourhood> {
    const graph = await this.knowledgeService.knowledgeGraph(user, projectId);
    const { node, edges, neighbours: nbrs } = neighbours(graph, nodeId);
    if (!node) return { node: null, edges: [], neighbours: [] };
    return {
      node: nodeToGql(node),
      edges: edges.map(edgeToGql),
      neighbours: nbrs.map(nodeToGql),
    };
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

  @Mutation(() => KnowledgeNodeType)
  async createKnowledgeNode(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateKnowledgeNodeInput,
  ): Promise<KnowledgeNodeType> {
    const row = await this.knowledgeService.createNode(user, {
      projectId: input.projectId,
      type: input.type as OkfNodeType,
      title: input.title,
      content: input.content,
      sourceRef: input.sourceRef,
    });
    return {
      id: row.id,
      projectId: row.projectId,
      type: row.type as OkfNodeTypeGql,
      title: row.title,
      content: row.content,
      sourceRef: row.sourceRef,
      createdAt: row.createdAt,
    };
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
