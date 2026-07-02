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

const DIR: Record<OkfNode['type'], string> = {
  Project: '',
  Hypothesis: 'hypotheses',
  Protocol: 'protocols',
  Reference: 'references',
};

function localId(nodeId: string): string {
  return nodeId.split(':')[1] ?? nodeId;
}

function filePath(node: OkfNode): string {
  if (node.type === 'Project') return 'index.md';
  return `${DIR[node.type]}/${localId(node.id)}.md`;
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

  const project = byId.get(graph.rootId);
  const outgoing = (id: string, predicate: string) =>
    graph.edges.filter((e) => e.from === id && e.predicate === predicate);
  const incoming = (id: string, predicate: string) =>
    graph.edges.filter((e) => e.to === id && e.predicate === predicate);

  // ── Project index.md ──
  if (project) {
    const hyps = outgoing(project.id, 'contains')
      .map((e) => byId.get(e.to))
      .filter((n): n is OkfNode => n?.type === 'Hypothesis');
    const prots = outgoing(project.id, 'contains')
      .map((e) => byId.get(e.to))
      .filter((n): n is OkfNode => n?.type === 'Protocol');

    let body = `# ${project.label}\n\n`;
    const desc = project.attributes['description'];
    if (typeof desc === 'string' && desc) body += `${desc}\n\n`;
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
          type: 'Project',
          title: project.label,
          description: desc,
        }) + body,
    });
  }

  // ── Per-type concept files + section indexes ──
  const groups: Record<string, OkfNode[]> = {
    Hypothesis: [],
    Reference: [],
    Protocol: [],
  };
  for (const n of graph.nodes) {
    if (n.type in groups) groups[n.type].push(n);
  }

  for (const h of groups['Hypothesis']) {
    const path = filePath(h);
    const citedRefs = outgoing(h.id, 'cites')
      .map((e) => byId.get(e.to))
      .filter((n): n is OkfNode => !!n);
    let body = `# ${h.label}\n\n`;
    body += `Part of ${linkTo(path, project!)}.\n\n`;
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
    files.push({
      path,
      content:
        frontmatter({
          type: 'Protocol',
          title: p.label,
          version: p.attributes['version'],
        }) + `# ${p.label}\n\nPart of ${linkTo(path, project!)}.\n`,
    });
  }

  // Section index.md files (progressive disclosure).
  for (const [type, dir] of [
    ['Hypothesis', 'hypotheses'],
    ['Reference', 'references'],
    ['Protocol', 'protocols'],
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
