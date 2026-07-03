import type { OkfGraph, OkfNode } from './okf';

// A single file in an OKF Knowledge Bundle: a relative path + markdown content.
export interface OkfFile {
  path: string;
  content: string;
}

// Open Knowledge Format v0.1 (GoogleCloudPlatform/knowledge-catalog): a bundle
// is a *directory of markdown files with YAML frontmatter*. One concept per
// file, the file path is the concept identity, concepts cross-link with normal
// markdown links, and `type` is the only required frontmatter field. `index.md`
// enables progressive disclosure.
//
// We render a Project's OKF graph into such a bundle:
//
//   index.md                      (Project — links to hypotheses/protocols)
//   hypotheses/index.md
//   hypotheses/<id>.md            (Hypothesis — links to cited References)
//   references/index.md
//   references/<id>.md            (Reference — `resource:` = source URL)
//   protocols/index.md
//   protocols/<id>.md             (Protocol)
//   notebooks/<id>.md             (Notebook — the computational record)
//   analyses/<id>.md              (Analysis)
//   theses/<id>.md                (Thesis — the write-up)

const DIR: Record<OkfNode['type'], string> = {
  Project: '',
  Hypothesis: 'hypotheses',
  Protocol: 'protocols',
  Reference: 'references',
  Notebook: 'notebooks',
  Analysis: 'analyses',
  Thesis: 'theses',
  // Author-first nodes (KnowledgeNode table) share a single bundle directory.
  Idea: 'nodes',
  Observation: 'nodes',
  Conclusion: 'nodes',
  Knowledge: 'nodes',
  Data: 'nodes',
  Paper: 'nodes',
};

function localId(nodeId: string): string {
  return nodeId.split(':')[1] ?? nodeId;
}

function filePath(node: OkfNode): string {
  if (node.type === 'Project') return 'index.md';
  return `${DIR[node.type]}/${localId(node.id)}.md`;
}

// Public: the bundle path a graph node maps to. This is the single source of
// truth for node → path used both to render the bundle and to key files back to
// their node (e.g. for titles + editability in the GraphQL browse API).
export function bundlePathForNode(node: OkfNode): string {
  return filePath(node);
}

// Relative markdown link from `fromPath` to the concept file for `to`.
function linkTo(fromPath: string, to: OkfNode): string {
  const target = filePath(to);
  const fromDepth = fromPath.split('/').length - 1;
  const prefix = fromDepth > 0 ? '../'.repeat(fromDepth) : './';
  return `[${escapeMd(to.label)}](${prefix}${target})`;
}

function frontmatter(fields: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((x) => JSON.stringify(x)).join(', ')}]`);
    } else if (typeof v === 'string' && !v.includes('\n')) {
      lines.push(`${k}: ${yamlScalar(v)}`);
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

export function toOkfBundle(graph: OkfGraph): OkfFile[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const files: OkfFile[] = [];

  const outgoing = (id: string, predicate: string) =>
    graph.edges.filter((e) => e.from === id && e.predicate === predicate);
  const incoming = (id: string, predicate: string) =>
    graph.edges.filter((e) => e.to === id && e.predicate === predicate);

  // ── Root index.md ──
  // The Project is no longer a rendered node (it is container context), so the
  // root index is assembled from the graph's top-level nodes directly.
  {
    const hyps = graph.nodes.filter((n) => n.type === 'Hypothesis');
    const prots = graph.nodes.filter((n) => n.type === 'Protocol');

    let body = `# Knowledge Graph\n\n`;
    body += `## Hypotheses\n\n`;
    body += hyps.length
      ? hyps.map((h) => `- ${linkTo('index.md', h)}`).join('\n') + '\n\n'
      : '_None yet._\n\n';
    body += `## Protocols\n\n`;
    body += prots.length
      ? prots.map((p) => `- ${linkTo('index.md', p)}`).join('\n') + '\n'
      : '_None yet._\n';

    files.push({
      path: 'index.md',
      content:
        frontmatter({
          type: 'Index',
          title: 'Knowledge Graph',
        }) + body,
    });
  }

  // ── Per-type concept files + section indexes ──
  const groups: Record<string, OkfNode[]> = {
    Hypothesis: [],
    Reference: [],
    Protocol: [],
    Notebook: [],
    Analysis: [],
    Thesis: [],
  };
  for (const n of graph.nodes) {
    // Authored nodes (node:<uuid>) are emitted separately, below.
    if (n.type in groups && !n.id.startsWith('node:')) groups[n.type].push(n);
  }

  for (const h of groups['Hypothesis']) {
    const path = filePath(h);
    const citedRefs = outgoing(h.id, 'cites')
      .map((e) => byId.get(e.to))
      .filter((n): n is OkfNode => !!n);
    let body = `# ${h.label}\n\n`;
    body += `Part of the [knowledge graph](${'../'.repeat(path.split('/').length - 1)}index.md).\n\n`;
    body += `## References\n\n`;
    if (citedRefs.length) {
      for (const r of citedRefs) {
        // Grounded stance edge (reference -> hypothesis), if any.
        const stance = graph.edges.find(
          (e) =>
            e.from === r.id &&
            e.to === h.id &&
            (e.predicate === 'supports' || e.predicate === 'contradicts'),
        );
        const tag = stance ? ` — **${stance.predicate}**` : '';
        const quote =
          stance && typeof stance.attributes['quote'] === 'string'
            ? ` — “${escapeMd(stance.attributes['quote'] as string)}”`
            : '';
        body += `- ${linkTo(path, r)}${tag}${quote}\n`;
      }
    } else {
      body += `_None attached._\n`;
    }
    files.push({
      path,
      content: frontmatter({ type: 'Hypothesis', title: h.label }) + body,
    });
  }

  for (const r of groups['Reference']) {
    const path = filePath(r);
    const url = r.attributes['url'];
    const citedBy = incoming(r.id, 'cites')
      .map((e) => byId.get(e.from))
      .filter((n): n is OkfNode => !!n);
    let body = `# ${r.label}\n\n`;
    if (citedBy.length) {
      body += `Cited by ${citedBy.map((h) => linkTo(path, h)).join(', ')}.\n`;
    }
    files.push({
      path,
      content:
        frontmatter({
          type: 'Reference',
          title: r.label,
          resource: typeof url === 'string' ? url : undefined,
        }) + body,
    });
  }

  for (const p of groups['Protocol']) {
    const path = filePath(p);
    const notebooks = outgoing(p.id, 'records')
      .map((e) => byId.get(e.to))
      .filter((n): n is OkfNode => !!n);
    const analyses = incoming(p.id, 'analyzes')
      .map((e) => byId.get(e.from))
      .filter((n): n is OkfNode => !!n);
    let body = `# ${p.label}\n\nPart of the [knowledge graph](${'../'.repeat(path.split('/').length - 1)}index.md).\n`;
    if (notebooks.length) {
      body += `\nRecorded by ${notebooks.map((n) => linkTo(path, n)).join(', ')}.\n`;
    }
    if (analyses.length) {
      body += `\nAnalyzed by ${analyses.map((a) => linkTo(path, a)).join(', ')}.\n`;
    }
    files.push({
      path,
      content:
        frontmatter({
          type: 'Protocol',
          title: p.label,
          version: p.attributes['version'],
        }) + body,
    });
  }

  // Notebook — the computational record of its Protocol.
  for (const nb of groups['Notebook']) {
    const path = filePath(nb);
    const protocol = incoming(nb.id, 'records')
      .map((e) => byId.get(e.from))
      .find((n): n is OkfNode => !!n);
    let body = `# ${nb.label}\n\n`;
    if (protocol) body += `Records ${linkTo(path, protocol)}.\n`;
    files.push({
      path,
      content:
        frontmatter({
          type: 'Notebook',
          title: nb.label,
          cells: nb.attributes['cells'],
        }) + body,
    });
  }

  // Analysis — computational work over a Protocol's data.
  for (const a of groups['Analysis']) {
    const path = filePath(a);
    const protocol = outgoing(a.id, 'analyzes')
      .map((e) => byId.get(e.to))
      .find((n): n is OkfNode => !!n);
    let body = `# ${a.label}\n\n`;
    if (protocol) body += `Analyzes ${linkTo(path, protocol)}.\n`;
    files.push({
      path,
      content: frontmatter({ type: 'Analysis', title: a.label }) + body,
    });
  }

  // Thesis — the write-up.
  for (const t of groups['Thesis']) {
    const path = filePath(t);
    files.push({
      path,
      content:
        frontmatter({ type: 'Thesis', title: t.label }) +
        `# ${t.label}\n\nPart of the [knowledge graph](${'../'.repeat(path.split('/').length - 1)}index.md).\n`,
    });
  }

  // Authored nodes (KnowledgeNode) — the researcher's own markdown, filed under
  // nodes/. `resource:` points at an attached source file (path/URL) when set.
  for (const n of graph.nodes) {
    if (!n.id.startsWith('node:')) continue;
    const path = filePath(n);
    const content =
      typeof n.attributes['content'] === 'string'
        ? (n.attributes['content'] as string)
        : '';
    const source =
      typeof n.attributes['sourceRef'] === 'string'
        ? (n.attributes['sourceRef'] as string)
        : undefined;
    const linked = graph.edges
      .filter(
        (e) =>
          e.predicate === 'linked' && (e.from === n.id || e.to === n.id),
      )
      .map((e) => byId.get(e.from === n.id ? e.to : e.from))
      .filter((x): x is OkfNode => !!x);
    let body = `# ${n.label}\n\nPart of the [knowledge graph](${'../'.repeat(
      path.split('/').length - 1,
    )}index.md).\n\n`;
    if (content) body += `${content}\n\n`;
    if (linked.length) {
      body += `Linked: ${linked.map((l) => linkTo(path, l)).join(', ')}.\n`;
    }
    files.push({
      path,
      content:
        frontmatter({ type: n.type, title: n.label, resource: source }) + body,
    });
  }

  // Section index.md files (progressive disclosure).
  for (const [type, dir] of [
    ['Hypothesis', 'hypotheses'],
    ['Reference', 'references'],
    ['Protocol', 'protocols'],
    ['Notebook', 'notebooks'],
    ['Analysis', 'analyses'],
    ['Thesis', 'theses'],
  ] as const) {
    const items = groups[type];
    if (!items.length) continue;
    const body =
      `# ${dir}\n\n` +
      items.map((n) => `- ${linkTo(`${dir}/index.md`, n)}`).join('\n') +
      '\n';
    files.push({
      path: `${dir}/index.md`,
      content: frontmatter({ type: 'Index', title: dir }) + body,
    });
  }

  return files;
}

function escapeMd(s: string): string {
  return s.replace(/\]/g, '\\]').replace(/\n/g, ' ');
}

function yamlScalar(s: string): string {
  // Quote only when the value would otherwise be ambiguous YAML: a leading
  // indicator char, a colon-space (mapping) or trailing colon, a leading/
  // trailing space, or a `#` comment start. A bare URL like http://x/1 is a
  // valid plain scalar and stays unquoted.
  const needsQuote =
    /^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) ||
    /: /.test(s) ||
    /:$/.test(s) ||
    / #/.test(s) ||
    /[\s]$/.test(s);
  return needsQuote ? JSON.stringify(s) : s;
}
