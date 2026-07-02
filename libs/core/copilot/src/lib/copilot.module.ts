import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { ResearchModule } from '@labda/core-research';
import { ProtocolModule } from '@labda/core-protocol';
import { ChallengeHypothesisTool } from './mcp/challenge-hypothesis.tool';
import { FindContradictingEvidenceTool } from './mcp/find-contradicting-evidence.tool';
import { CopilotFacade } from './copilot.facade';
import { CopilotResolver } from './copilot.resolver';
import { CopilotService } from './copilot.service';

@Module({
  imports: [
    ResearchModule,
    ProtocolModule,
    McpModule.forFeature(
      [ChallengeHypothesisTool, FindContradictingEvidenceTool],
      'labda',
    ),
  ],
  providers: [
    CopilotService,
    CopilotFacade,
    CopilotResolver,
    ChallengeHypothesisTool,
    FindContradictingEvidenceTool,
  ],
  exports: [CopilotFacade], // Facade only (ADR-0005)
})
export class CopilotModule {}
