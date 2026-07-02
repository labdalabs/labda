import type {
  CellOutput,
  ExecuteResult,
  KernelVariable,
  NotebookKernel,
} from './types';

// A remote kernel backed by a real Jupyter server (Jupyter Kernel Gateway or a
// notebook server), speaking the Jupyter REST + WebSocket messaging protocol.
// This is the hosted-kernel path (ADR-0024 fast-follow, ADR-0027) behind the
// same NotebookKernel interface as the in-browser Pyodide kernel — the editor
// doesn't care which is active.

interface JupyterConfig {
  baseUrl: string; // e.g. http://127.0.0.1:8888
  token?: string;
}

interface JupyterMessage {
  channel?: string;
  header: { msg_id: string; msg_type: string; session: string; version: string };
  parent_header: Record<string, unknown>;
  metadata: Record<string, unknown>;
  content: Record<string, unknown>;
}

const INSPECT_SRC = `
import json as _json, types as _types
def _labda_inspect():
    out = []
    for _k, _v in list(globals().items()):
        if _k.startswith('_'): continue
        if isinstance(_v, _types.ModuleType) or callable(_v): continue
        try: _r = repr(_v)
        except Exception: _r = '<unrepr-able>'
        if len(_r) > 200: _r = _r[:200] + '…'
        out.append({'name': _k, 'type': type(_v).__name__, 'repr': _r})
    print('__LABDA_VARS__' + _json.dumps(out))
_labda_inspect()
`;

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}-${Date.now()}`;
}

export class JupyterKernel implements NotebookKernel {
  private ws?: WebSocket;
  private kernelId?: string;
  private readonly session = uid('labda-session');
  private executionCount = 0;
  private connecting?: Promise<void>;

  constructor(private readonly config: JupyterConfig) {}

  async ready(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (!this.connecting) this.connecting = this.connect();
    await this.connecting;
  }

  private authQuery(): string {
    return this.config.token ? `?token=${encodeURIComponent(this.config.token)}` : '';
  }

  // A "simple" request (text/plain, token in the URL, no custom headers) so the
  // browser doesn't send a CORS preflight — many Jupyter servers 403 the
  // preflight OPTIONS. The server still parses the JSON body; token-in-URL auth
  // also bypasses XSRF.
  private simplePost(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.config.baseUrl}${path}${this.authQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body),
    });
  }

  private async connect(): Promise<void> {
    const res = await this.simplePost('/api/kernels', { name: 'python3' });
    if (!res.ok) throw new Error(`Failed to start Jupyter kernel (${res.status})`);
    const kernel = (await res.json()) as { id: string };
    this.kernelId = kernel.id;

    const wsBase = this.config.baseUrl.replace(/^http/, 'ws');
    const url = `${wsBase}/api/kernels/${kernel.id}/channels${this.authQuery()}`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Jupyter WebSocket error'));
      this.ws = ws;
    });
  }

  async execute(
    code: string,
    onStream?: (o: Extract<CellOutput, { output_type: 'stream' }>) => void,
  ): Promise<ExecuteResult> {
    await this.ready();
    const ws = this.ws!;
    const msgId = uid('execute');
    this.executionCount += 1;
    const outputs: CellOutput[] = [];

    const request: JupyterMessage = {
      channel: 'shell',
      header: {
        msg_id: msgId,
        msg_type: 'execute_request',
        session: this.session,
        version: '5.3',
      },
      parent_header: {},
      metadata: {},
      content: {
        code,
        silent: false,
        store_history: true,
        user_expressions: {},
        allow_stdin: false,
        stop_on_error: true,
      },
    };

    return new Promise<ExecuteResult>((resolve, reject) => {
      const onMessage = (evt: MessageEvent) => {
        let msg: JupyterMessage;
        try {
          msg = JSON.parse(evt.data as string) as JupyterMessage;
        } catch {
          return;
        }
        const parentId = (msg.parent_header as { msg_id?: string })?.msg_id;
        if (parentId !== msgId) return;

        const t = msg.header.msg_type;
        const c = msg.content;
        if (t === 'stream') {
          const out = {
            output_type: 'stream',
            name: (c['name'] as 'stdout' | 'stderr') ?? 'stdout',
            text: (c['text'] as string) ?? '',
          } as Extract<CellOutput, { output_type: 'stream' }>;
          outputs.push(out);
          onStream?.(out);
        } else if (t === 'execute_result') {
          outputs.push({
            output_type: 'execute_result',
            data: (c['data'] as Record<string, unknown>) ?? {},
            metadata: (c['metadata'] as Record<string, unknown>) ?? {},
            execution_count: (c['execution_count'] as number) ?? this.executionCount,
          });
        } else if (t === 'display_data') {
          outputs.push({
            output_type: 'display_data',
            data: (c['data'] as Record<string, unknown>) ?? {},
            metadata: (c['metadata'] as Record<string, unknown>) ?? {},
          });
        } else if (t === 'error') {
          outputs.push({
            output_type: 'error',
            ename: (c['ename'] as string) ?? 'Error',
            evalue: (c['evalue'] as string) ?? '',
            traceback: (c['traceback'] as string[]) ?? [],
          });
        } else if (t === 'status' && (c['execution_state'] as string) === 'idle') {
          ws.removeEventListener('message', onMessage);
          resolve({ outputs, executionCount: this.executionCount });
        }
      };
      ws.addEventListener('message', onMessage);
      ws.addEventListener('error', () => reject(new Error('Jupyter execution failed')), {
        once: true,
      });
      ws.send(JSON.stringify(request));
    });
  }

  async variables(): Promise<KernelVariable[]> {
    const result = await this.execute(INSPECT_SRC);
    for (const o of result.outputs) {
      if (o.output_type === 'stream' && o.text.includes('__LABDA_VARS__')) {
        const json = o.text.slice(o.text.indexOf('__LABDA_VARS__') + '__LABDA_VARS__'.length);
        try {
          return JSON.parse(json) as KernelVariable[];
        } catch {
          return [];
        }
      }
    }
    return [];
  }

  async reset(): Promise<void> {
    if (!this.kernelId) return;
    await this.simplePost(`/api/kernels/${this.kernelId}/restart`, {});
    this.executionCount = 0;
  }
}

export function makeJupyterKernel(config: JupyterConfig): NotebookKernel {
  return new JupyterKernel(config);
}
