import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { RunAnalysisTool } from './mcp/run-analysis.tool';
import { AnalysisFacade } from './analysis.facade';
import { AnalysisResolver } from './analysis.resolver';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [McpModule.forFeature([RunAnalysisTool], 'labda')],
  providers: [
    AnalysisService,
    AnalysisFacade,
    AnalysisResolver,
    RunAnalysisTool,
  ],
  exports: [AnalysisFacade], // Facade only (ADR-0005)
})
export class AnalysisModule {}
