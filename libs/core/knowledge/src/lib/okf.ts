// Open Knowledge Format (OKF)-shaped graph for a research Project. Entities
// become nodes; typed relations become edges. This is the explicit, typed
// counterpart to the vector embeddings from the literature context — relations
// here are stated, not inferred from similarity.
//
// OKF reference: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing

export type OkfNodeType =
  | 'Project'
  | 'Hypothesis'
  | 'Protocol'
  | 'Reference'
  | 'Notebook' // the computational record (Jupyter) of a Protocol
  | 'Analysis' // computational work over a Protocol's data
  | 'Thesis'; // the write-up (Report → Preprint → Paper); forthcoming entity

export type OkfPredicate =
  | 'contains' // Project → Hypothesis / Protocol / Thesis
  | 'cites' // Hypothesis → Reference
  | 'supports' // Reference → Hypothesis (grounded stance)
  | 'contradicts' // Reference → Hypothesis (grounded stance)
  | 'records' // Protocol → Notebook (the notebook records the run)
  | 'analyzes' // Analysis → Protocol (work over its data)
  | 'linked'; // user-drawn link between any two nodes (Obsidian-like)

export interface OkfNode {
  id: string;
  type: OkfNodeType;
  label: string;
  attributes: Record<string, unknown>;
}

export interface OkfEdge {
  id: string;
  from: string;
  to: string;
  predicate: OkfPredicate;
  attributes: Record<string, unknown>;
}

export interface OkfGraph {
  format: 'okf/1.0';
  rootId: string;
  nodes: OkfNode[];
  edges: OkfEdge[];
}

export interface GraphInputs {
  project: { id: string; title: string; description: string | null };
  hypotheses: { id: string; statement: string }[];
  // References + grounded stance per hypothesis id.
  referencesByHypothesis: Record<
    string,
    { id: string; title: string; url: string | null }[]
  >;
  stancesByHypothesis: Record<
    string,
    { referenceId: string; predicate: 'supports' | 'contradicts'; quote?: string }[]
  >;
  protocols: { id: string; title: string; version: number }[];
  // Jupyter notebooks — the computational record of a Protocol (ADR-0024).
  notebooks?: { protocolId: string; title: string; cells: number }[];
  // Computational work over a Protocol's data.
  analyses?: { id: string; protocolId: string; name: string }[];
  // Write-ups (Report → Preprint → Paper). No authoring entity exists yet;
  // the graph is ready for them the moment one does.
  theses?: { id: string; title: string }[];
  // User-drawn links between existing node ids (Obsidian-like).
  links?: { id: string; fromNodeId: string; toNodeId: string; label: string | null }[];
}

export function buildOkfGraph(input: GraphInputs): OkfGraph {
  const nodes: OkfNode[] = [];
  const edges: OkfEdge[] = [];
  const seenNodes = new Set<string>();

  const addNode = (n: OkfNode) => {
    if (seenNodes.has(n.id)) return;
    seenNodes.add(n.id);
    nodes.push(n);
  };
  const addEdge = (from: string, to: string, predicate: OkfPredicate, attributes: Record<string, unknown> = {}) => {
    edges.push({ id: `${predicate}:${from}->${to}`, from, to, predicate, attributes });
  };

  const projectNodeId = `project:${input.project.id}`;
  addNode({
    id: projectNodeId,
    type: 'Project',
    label: input.project.title,
    attributes: { description: input.project.description },
  });

  for (const h of input.hypotheses) {
    const hId = `hypothesis:${h.id}`;
    addNode({ id: hId, type: 'Hypothesis', label: h.statement, attributes: {} });
    addEdge(projectNodeId, hId, 'contains');

    const refs = input.referencesByHypothesis[h.id] ?? [];
    const stances = input.stancesByHypothesis[h.id] ?? [];
    const stanceByRef = new Map(stances.map((s) => [s.referenceId, s]));

    for (const r of refs) {
      const rId = `reference:${r.id}`;
      addNode({
        id: rId,
        type: 'Reference',
        label: r.title,
        attributes: { url: r.url },
      });
      addEdge(hId, rId, 'cites');

      const stance = stanceByRef.get(r.id);
      if (stance) {
        addEdge(rId, hId, stance.predicate, { quote: stance.quote });
      }
    }
  }

  for (const p of input.protocols) {
    const pId = `protocol:${p.id}`;
    addNode({
      id: pId,
      type: 'Protocol',
      label: p.title,
      attributes: { version: p.version },
    });
    addEdge(projectNodeId, pId, 'contains');
  }

  // Notebooks — one per Protocol that has a computational record.
  for (const nb of input.notebooks ?? []) {
    const pId = `protocol:${nb.protocolId}`;
    if (!seenNodes.has(pId)) continue;
    const nbId = `notebook:${nb.protocolId}`;
    addNode({
      id: nbId,
      type: 'Notebook',
      label: nb.title,
      attributes: { cells: nb.cells, protocolId: nb.protocolId },
    });
    addEdge(pId, nbId, 'records');
  }

  // Analyses — computational work over a Protocol's data.
  for (const a of input.analyses ?? []) {
    const pId = `protocol:${a.protocolId}`;
    if (!seenNodes.has(pId)) continue;
    const aId = `analysis:${a.id}`;
    addNode({
      id: aId,
      type: 'Analysis',
      label: a.name,
      attributes: { protocolId: a.protocolId },
    });
    addEdge(aId, pId, 'analyzes');
  }

  // Theses — write-ups belonging to the Project.
  for (const t of input.theses ?? []) {
    const tId = `thesis:${t.id}`;
    addNode({ id: tId, type: 'Thesis', label: t.title, attributes: {} });
    addEdge(projectNodeId, tId, 'contains');
  }

  // User-drawn links — only between nodes that exist in this graph.
  for (const l of input.links ?? []) {
    if (seenNodes.has(l.fromNodeId) && seenNodes.has(l.toNodeId)) {
      edges.push({
        id: `linked:${l.id}`,
        from: l.fromNodeId,
        to: l.toNodeId,
        predicate: 'linked',
        attributes: { label: l.label, linkId: l.id },
      });
    }
  }

  return { format: 'okf/1.0', rootId: projectNodeId, nodes, edges };
}

// Free browse (fff-style): the neighbourhood of a node — its incident edges and
// the nodes on the other end. This is the primitive the antagonistic agent uses
// to walk the graph.
export function neighbours(
  graph: OkfGraph,
  nodeId: string,
): { node: OkfNode | undefined; edges: OkfEdge[]; neighbours: OkfNode[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const incident = graph.edges.filter((e) => e.from === nodeId || e.to === nodeId);
  const neighbourIds = new Set(
    incident.map((e) => (e.from === nodeId ? e.to : e.from)),
  );
  return {
    node: byId.get(nodeId),
    edges: incident,
    neighbours: [...neighbourIds].map((id) => byId.get(id)).filter((n): n is OkfNode => !!n),
  };
}
