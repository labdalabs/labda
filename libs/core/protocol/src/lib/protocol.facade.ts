import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '@labda/core-common';
import { ProtocolService } from './protocol.service';
import type {
  CreateProtocolInput,
  ProtocolDto,
  SaveProtocolInput,
} from './protocol.models';

// Public service-to-service surface of the protocol context (ADR-0005).
@Injectable()
export class ProtocolFacade {
  private readonly logger = new Logger(ProtocolFacade.name);

  constructor(private readonly protocolService: ProtocolService) {}

  createProtocol(
    user: AuthenticatedUser,
    input: CreateProtocolInput,
  ): Promise<ProtocolDto> {
    return this.protocolService.createProtocol(user, input);
  }

  saveProtocol(
    user: AuthenticatedUser,
    input: SaveProtocolInput,
  ): Promise<ProtocolDto> {
    return this.protocolService.saveProtocol(user, input);
  }

  getProtocol(user: AuthenticatedUser, id: string): Promise<ProtocolDto> {
    return this.protocolService.getProtocol(user, id);
  }

  listProtocols(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<ProtocolDto[]> {
    return this.protocolService.listProtocols(user, projectId);
  }
}
