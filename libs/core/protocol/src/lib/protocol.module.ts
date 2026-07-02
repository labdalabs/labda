import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { CreateProtocolTool } from './mcp/create-protocol.tool';
import { ProtocolFacade } from './protocol.facade';
import { ProtocolResolver } from './protocol.resolver';
import { ProtocolService } from './protocol.service';

@Module({
  imports: [McpModule.forFeature([CreateProtocolTool], 'labda')],
  providers: [
    ProtocolService,
    ProtocolFacade,
    ProtocolResolver,
    CreateProtocolTool,
  ],
  exports: [ProtocolFacade], // Facade only (ADR-0005)
})
export class ProtocolModule {}
