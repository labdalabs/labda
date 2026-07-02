import { Type, plainToInstance } from 'class-transformer';
import { IsString, IsUUID, ValidateNested } from 'class-validator';
import { DomainEvent } from '@labda/core-common';

export class AnalysisCreatedEventPayload {
  @IsUUID() analysisId!: string;
  @IsUUID() protocolId!: string;
  @IsString() ownerId!: string;
  @IsString() name!: string;
}

export class AnalysisCreatedEvent extends DomainEvent<AnalysisCreatedEventPayload> {
  static readonly type = 'AnalysisCreated';
  readonly eventType = AnalysisCreatedEvent.type;

  @ValidateNested()
  @Type(() => AnalysisCreatedEventPayload)
  readonly payload: AnalysisCreatedEventPayload;

  constructor(payload: AnalysisCreatedEventPayload) {
    super();
    this.payload = plainToInstance(AnalysisCreatedEventPayload, payload);
  }
}
