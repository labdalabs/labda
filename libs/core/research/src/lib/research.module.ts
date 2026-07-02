import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { CreateProjectTool } from './mcp/create-project.tool';
import { ListProjectsTool } from './mcp/list-projects.tool';
import { ResearchFacade } from './research.facade';
import { ResearchResolver } from './research.resolver';
import { ResearchService } from './research.service';

@Module({
  imports: [
    McpModule.forFeature([CreateProjectTool, ListProjectsTool], 'labda'),
  ],
  providers: [
    ResearchService,
    ResearchFacade,
    ResearchResolver,
    CreateProjectTool,
    ListProjectsTool,
  ],
  exports: [ResearchFacade], // Facade only (ADR-0005)
})
export class ResearchModule {}
