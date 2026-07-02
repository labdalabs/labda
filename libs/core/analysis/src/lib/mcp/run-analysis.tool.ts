import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { AuthenticatedUser } from '@labda/core-common';
import { AnalysisService } from '../analysis.service';

interface AuthedRequest {
  user?: AuthenticatedUser;
}

const runAnalysisParameters = z.object({
  protocolId: z.string().uuid().describe('The Protocol these results belong to.'),
  name: z.string().min(1).max(200).describe('A name for the Analysis.'),
  data: z
    .string()
    .describe(
      'Dataset as JSON: {"columns": string[], "rows": number[][]}. ' +
        'Descriptive statistics are computed per column.',
    ),
});

type RunAnalysisParams = z.infer<typeof runAnalysisParameters>;

@Injectable()
export class RunAnalysisTool {
  constructor(private readonly analysisService: AnalysisService) {}

  @Tool({
    name: 'run_analysis',
    description:
      'Run a data Analysis over a dataset derived from a Protocol\'s results: ' +
      'computes descriptive statistics per column and a chart. Export to Excel ' +
      'is available separately.',
    parameters: runAnalysisParameters,
  })
  async execute(params: RunAnalysisParams, _ctx: unknown, req: AuthedRequest) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    const created = await this.analysisService.runAnalysis(user, params);
    return {
      content: [{ type: 'text', text: JSON.stringify(created) }],
    };
  }
}
