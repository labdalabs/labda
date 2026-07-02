import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { ResearchModule } from '@labda/core-research';
import { ProtocolModule } from '@labda/core-protocol';
import { CopilotModule } from '@labda/core-copilot';
import { AnalysisModule } from '@labda/core-analysis';
import { BrowseKnowledgeTool } from './mcp/browse-knowledge.tool';
import { KnowledgeFacade } from './knowledge.facade';
import { KnowledgeResolver } from './knowledge.resolver';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [
    ResearchModule,
    ProtocolModule,
    CopilotModule,
    AnalysisModule,
    McpModule.forFeature([BrowseKnowledgeTool], 'labda'),
  ],
  providers: [
    KnowledgeService,
    KnowledgeFacade,
    KnowledgeResolver,
    BrowseKnowledgeTool,
  ],
  exports: [KnowledgeFacade], // Facade only (ADR-0005)
})
export class KnowledgeModule {}
