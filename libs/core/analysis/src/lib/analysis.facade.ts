import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '@labda/core-common';
import { AnalysisService } from './analysis.service';
import type {
  AnalysisDto,
  AnalysisExport,
  RunAnalysisInput,
} from './analysis.models';

// Public service-to-service surface of the analysis context (ADR-0005).
@Injectable()
export class AnalysisFacade {
  private readonly logger = new Logger(AnalysisFacade.name);

  constructor(private readonly analysisService: AnalysisService) {}

  runAnalysis(
    user: AuthenticatedUser,
    input: RunAnalysisInput,
  ): Promise<AnalysisDto> {
    return this.analysisService.runAnalysis(user, input);
  }

  getAnalysis(user: AuthenticatedUser, id: string): Promise<AnalysisDto> {
    return this.analysisService.getAnalysis(user, id);
  }

  listAnalyses(
    user: AuthenticatedUser,
    protocolId: string,
  ): Promise<AnalysisDto[]> {
    return this.analysisService.listAnalyses(user, protocolId);
  }

  exportAnalysis(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AnalysisExport> {
    return this.analysisService.exportAnalysis(user, id);
  }
}
