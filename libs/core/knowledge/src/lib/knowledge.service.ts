import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DB_CONNECTION,
  SUPABASE_ADMIN,
  knowledgeLink,
  knowledgeNode,
  nodePosition,
} from '@labda/core-common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ResearchFacade } from '@labda/core-research';
import { ProtocolFacade } from '@labda/core-protocol';
import { CopilotFacade } from '@labda/core-copilot';
import { AnalysisFacade } from '@labda/core-analysis';
import {
  buildOkfGraph,
  neighbours,
  type GraphInputs,
  type OkfGraph,
  type OkfNodeType,
} from './okf';
import { toOkfBundle, type OkfFile } from './okf-bundle';

type LinkRow = typeof knowledgeLink.$inferSelect;
type NodeRow = typeof knowledgeNode.$inferSelect;
type PositionRow = typeof nodePosition.$inferSelect;

// Cell count of an nbformat JSON string; 0 when unparseable.
function countNotebookCells(notebook: string): number {
  try {
    const parsed = JSON.parse(notebook) as { cells?: unknown[] };
    return Array.isArray(parsed.cells) ? parsed.cells.length : 0;
  } catch {
    return 0;
  }
}

const OKF_BUCKET = 'knowledge-okf';
const SIGNED_URL_TTL_SEC = 60 * 60;
// Where the agent fetches a local OKF copy to browse (issue #18).
const OKF_LOCAL_DIR = process.env.OKF_LOCAL_DIR ?? '/tmp/labda';

export interface OkfLocalExport {
  dir: string;
  files: string[];
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    private readonly researchFacade: ResearchFacade,
    private readonly protocolFacade: ProtocolFacade,
    private readonly copilotFacade: CopilotFacade,
    private readonly analysisFacade: AnalysisFacade,
  ) {}

  // Derive the OKF graph for a Project from the current entities + grounded
  // copilot stances + user-drawn links. Owner-scoped via the facades.
  async knowledgeGraph(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<OkfGraph> {
    const project = await this.researchFacade.getProject(user, projectId);
    const hypotheses = await this.researchFacade.listHypotheses(user, projectId);
    const protocols = await this.protocolFacade.listProtocols(user, projectId);

    const referencesByHypothesis: GraphInputs['referencesByHypothesis'] = {};
    const stancesByHypothesis: GraphInputs['stancesByHypothesis'] = {};

    for (const h of hypotheses) {
      const refs = await this.researchFacade.listReferences(user, h.id);
      referencesByHypothesis[h.id] = refs.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
      }));

      const findings = await this.copilotFacade.challengeHypothesis(user, h.id);
      stancesByHypothesis[h.id] = findings
        .filter(
          (f) =>
            (f.kind === 'supports' || f.kind === 'contradicts') &&
            !!f.referenceId,
        )
        .map((f) => ({
          referenceId: f.referenceId as string,
          predicate: f.kind as 'supports' | 'contradicts',
          quote: f.quote,
        }));
    }

    // Notebooks — every Protocol carries an nbformat record (ADR-0024); the
    // graph surfaces it as its own node so cross-notebook work is visible.
    const notebooks = protocols.map((p) => ({
      protocolId: p.id,
      title: `${p.title} — notebook`,
      cells: countNotebookCells(p.notebook),
    }));

    // Analyses — computational work over each Protocol's data.
    const analyses = (
      await Promise.all(
        protocols.map(async (p) =>
          (await this.analysisFacade.listAnalyses(user, p.id)).map((a) => ({
            id: a.id,
            protocolId: a.protocolId,
            name: a.name,
          })),
        ),
      )
    ).flat();

    const links = await this.listLinks(user, projectId);
    const authored = await this.listNodes(user, projectId);
    const positions = await this.listPositions(user, projectId);
    const positionsByNodeId: Record<string, { q: number; r: number }> = {};
    for (const p of positions) {
      positionsByNodeId[p.nodeId] = { q: p.q, r: p.r };
    }

    return buildOkfGraph({
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
      },
      hypotheses: hypotheses.map((h) => ({ id: h.id, statement: h.statement })),
      referencesByHypothesis,
      stancesByHypothesis,
      protocols: protocols.map((p) => ({
        id: p.id,
        title: p.title,
        version: p.version,
      })),
      notebooks,
      analyses,
      // Thesis is modelled in the graph (node type + OKF dir) but no
      // authoring entity exists yet — see CONTEXT.md "Forthcoming".
      theses: [],
      links: links.map((l) => ({
        id: l.id,
        fromNodeId: l.fromNodeId,
        toNodeId: l.toNodeId,
        label: l.label,
      })),
      authoredNodes: authored.map((n) => ({
        id: n.id,
        type: n.type as OkfNodeType,
        title: n.title,
        content: n.content,
        sourceRef: n.sourceRef,
        attributes: n.attributes,
      })),
      positions: positionsByNodeId,
    });
  }

  // ── User-drawn links (Obsidian-like) ──

  async linkNodes(
    user: AuthenticatedUser,
    input: {
      projectId: string;
      fromNodeId: string;
      toNodeId: string;
      label?: string;
    },
  ): Promise<LinkRow> {
    // Ownership check (throws if not the caller's Project).
    await this.researchFacade.getProject(user, input.projectId);
    const [row] = await this.db
      .insert(knowledgeLink)
      .values({
        projectId: input.projectId,
        ownerId: user.id,
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        label: input.label ?? null,
      })
      .returning();
    this.logger.log(
      { projectId: input.projectId, from: input.fromNodeId, to: input.toNodeId },
      'Linked knowledge nodes',
    );
    return row;
  }

  async listLinks(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<LinkRow[]> {
    await this.researchFacade.getProject(user, projectId);
    return this.db
      .select()
      .from(knowledgeLink)
      .where(eq(knowledgeLink.projectId, projectId))
      .orderBy(desc(knowledgeLink.createdAt));
  }

  // ── Authored knowledge nodes (user/agent-written first-class nodes) ──

  async listNodes(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<NodeRow[]> {
    await this.researchFacade.getProject(user, projectId);
    return this.db
      .select()
      .from(knowledgeNode)
      .where(eq(knowledgeNode.projectId, projectId))
      .orderBy(desc(knowledgeNode.createdAt));
  }

  async createNode(
    user: AuthenticatedUser,
    input: {
      projectId: string;
      type: OkfNodeType;
      title: string;
      content?: string;
      sourceRef?: string;
    },
  ): Promise<NodeRow> {
    // Ownership check (throws if not the caller's Project).
    await this.researchFacade.getProject(user, input.projectId);
    const [row] = await this.db
      .insert(knowledgeNode)
      .values({
        projectId: input.projectId,
        ownerId: user.id,
        type: input.type,
        title: input.title,
        content: input.content ?? '',
        sourceRef: input.sourceRef ?? null,
      })
      .returning();
    this.logger.log(
      { projectId: input.projectId, type: input.type },
      'Created knowledge node',
    );
    return row;
  }

  async updateNode(
    user: AuthenticatedUser,
    id: string,
    patch: { title?: string; content?: string; sourceRef?: string },
  ): Promise<NodeRow> {
    const [existing] = await this.db
      .select()
      .from(knowledgeNode)
      .where(eq(knowledgeNode.id, id));
    if (!existing) {
      throw new Error('Knowledge node not found');
    }
    // Access: owner OR ProjectMember of the node's Project (throws otherwise).
    await this.researchFacade.getProject(user, existing.projectId);
    const [row] = await this.db
      .update(knowledgeNode)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.sourceRef !== undefined ? { sourceRef: patch.sourceRef } : {}),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeNode.id, id))
      .returning();
    return row;
  }

  // Delete an authored node, its board position, and any links referencing it.
  async deleteNode(user: AuthenticatedUser, id: string): Promise<boolean> {
    const [existing] = await this.db
      .select()
      .from(knowledgeNode)
      .where(eq(knowledgeNode.id, id));
    if (!existing) {
      throw new Error('Knowledge node not found');
    }
    // Access: owner OR ProjectMember of the node's Project (throws otherwise).
    await this.researchFacade.getProject(user, existing.projectId);

    const okfId = `node:${id}`;
    await this.db.delete(knowledgeNode).where(eq(knowledgeNode.id, id));
    await this.db
      .delete(nodePosition)
      .where(
        and(
          eq(nodePosition.projectId, existing.projectId),
          eq(nodePosition.nodeId, okfId),
        ),
      );
    await this.db
      .delete(knowledgeLink)
      .where(
        or(
          eq(knowledgeLink.fromNodeId, okfId),
          eq(knowledgeLink.toNodeId, okfId),
        ),
      );
    this.logger.log({ id }, 'Deleted knowledge node');
    return true;
  }

  // Delete a user-drawn link, gated by access to its Project.
  async unlink(user: AuthenticatedUser, linkId: string): Promise<boolean> {
    const [existing] = await this.db
      .select()
      .from(knowledgeLink)
      .where(eq(knowledgeLink.id, linkId));
    if (!existing) {
      throw new Error('Knowledge link not found');
    }
    // Access: owner OR ProjectMember of the link's Project (throws otherwise).
    await this.researchFacade.getProject(user, existing.projectId);
    await this.db.delete(knowledgeLink).where(eq(knowledgeLink.id, linkId));
    this.logger.log({ linkId }, 'Unlinked knowledge nodes');
    return true;
  }

  // ── Hex-grid board positions ──

  async listPositions(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<PositionRow[]> {
    await this.researchFacade.getProject(user, projectId);
    return this.db
      .select()
      .from(nodePosition)
      .where(eq(nodePosition.projectId, projectId));
  }

  async setPosition(
    user: AuthenticatedUser,
    input: { projectId: string; nodeId: string; q: number; r: number },
  ): Promise<PositionRow> {
    // Access: owner OR ProjectMember of the Project (throws otherwise).
    await this.researchFacade.getProject(user, input.projectId);
    const [row] = await this.db
      .insert(nodePosition)
      .values({
        projectId: input.projectId,
        nodeId: input.nodeId,
        q: input.q,
        r: input.r,
      })
      .onConflictDoUpdate({
        target: [nodePosition.projectId, nodePosition.nodeId],
        set: { q: input.q, r: input.r, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  // fff-style free browse: the neighbourhood of a node in the Project graph.
  async browse(
    user: AuthenticatedUser,
    projectId: string,
    nodeId: string,
  ): Promise<ReturnType<typeof neighbours>> {
    const graph = await this.knowledgeGraph(user, projectId);
    return neighbours(graph, nodeId);
  }

  // ── OKF bundle export (to-spec: a directory of markdown files) ──

  // Remote: upload the OKF Knowledge Bundle to Supabase Storage; return a
  // signed URL to the bundle's index.md.
  async exportOkf(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<{ url: string; path: string }> {
    const files = toOkfBundle(await this.knowledgeGraph(user, projectId));
    const base = `${user.id}/${projectId}`;

    for (const f of files) {
      const { error } = await this.supabase.storage
        .from(OKF_BUCKET)
        .upload(`${base}/${f.path}`, Buffer.from(f.content), {
          contentType: 'text/markdown',
          upsert: true,
        });
      if (error) {
        this.logger.error('Failed to upload OKF file', { path: f.path, error });
        throw new Error('Failed to store the knowledge bundle');
      }
    }

    const indexPath = `${base}/index.md`;
    const { data: signed, error: signError } = await this.supabase.storage
      .from(OKF_BUCKET)
      .createSignedUrl(indexPath, SIGNED_URL_TTL_SEC);
    if (signError || !signed) {
      throw new Error('Failed to produce a download URL');
    }
    this.logger.log(
      { projectId, files: files.length },
      'Exported OKF bundle to Storage',
    );
    return { url: signed.signedUrl, path: indexPath };
  }

  // Local: write the OKF Knowledge Bundle to the filesystem (default
  // /tmp/labda/<projectId>) so the agent can initialise/browse it locally.
  async exportOkfLocal(
    user: AuthenticatedUser,
    projectId: string,
    baseDir: string = OKF_LOCAL_DIR,
  ): Promise<OkfLocalExport> {
    const files = toOkfBundle(await this.knowledgeGraph(user, projectId));
    const root = join(baseDir, projectId);
    const written: string[] = [];
    for (const f of files) {
      const full = join(root, f.path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, f.content, 'utf8');
      written.push(f.path);
    }
    this.logger.log({ projectId, dir: root, files: written.length }, 'Wrote OKF bundle locally');
    return { dir: root, files: written };
  }

  // Convenience for building the bundle in-memory (used by tests/tools).
  async buildBundle(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<OkfFile[]> {
    return toOkfBundle(await this.knowledgeGraph(user, projectId));
  }
}
