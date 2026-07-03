import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { CreateProjectTool } from './mcp/create-project.tool';
import { ListProjectsTool } from './mcp/list-projects.tool';
import { EmbeddingService } from './literature/embedding.service';
import { LiteratureQueue } from './literature/literature.queue';
import { LiteratureResolver } from './literature/literature.resolver';
import { LiteratureService } from './literature/literature.service';
import { SearchLiteratureTool } from './literature/mcp/search-literature.tool';
import { SemanticScholarClient } from './literature/semantic-scholar.client';
import { ResearchFacade } from './research.facade';
import { ResearchResolver } from './research.resolver';
import { ResearchService } from './research.service';
import { SessionResolver } from './session.resolver';
import { SessionService } from './session.service';

@Module({
  imports: [
    McpModule.forFeature(
      [CreateProjectTool, ListProjectsTool, SearchLiteratureTool],
      'labda',
    ),
  ],
  providers: [
    ResearchService,
    ResearchFacade,
    ResearchResolver,
    // agent-session concern
    SessionService,
    SessionResolver,
    CreateProjectTool,
    ListProjectsTool,
    // literature concern
    LiteratureService,
    LiteratureResolver,
    LiteratureQueue,
    SemanticScholarClient,
    EmbeddingService,
    SearchLiteratureTool,
  ],
  exports: [ResearchFacade], // Facade only (ADR-0005)
})
export class ResearchModule {}
