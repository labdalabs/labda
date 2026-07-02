import { Type, plainToInstance } from 'class-transformer';
import { IsInt, IsString, IsUUID, ValidateNested } from 'class-validator';
import { DomainEvent } from '@labda/core-common';

export class ProtocolCreatedEventPayload {
  @IsUUID() protocolId!: string;
  @IsUUID() projectId!: string;
  @IsString() ownerId!: string;
  @IsString() title!: string;
}

export class ProtocolCreatedEvent extends DomainEvent<ProtocolCreatedEventPayload> {
  static readonly type = 'ProtocolCreated';
  readonly eventType = ProtocolCreatedEvent.type;

  @ValidateNested()
  @Type(() => ProtocolCreatedEventPayload)
  readonly payload: ProtocolCreatedEventPayload;

  constructor(payload: ProtocolCreatedEventPayload) {
    super();
    this.payload = plainToInstance(ProtocolCreatedEventPayload, payload);
  }
}

export class ProtocolSavedEventPayload {
  @IsUUID() protocolId!: string;
  @IsUUID() projectId!: string;
  @IsString() ownerId!: string;
  @IsInt() version!: number;
}

export class ProtocolSavedEvent extends DomainEvent<ProtocolSavedEventPayload> {
  static readonly type = 'ProtocolSaved';
  readonly eventType = ProtocolSavedEvent.type;

  @ValidateNested()
  @Type(() => ProtocolSavedEventPayload)
  readonly payload: ProtocolSavedEventPayload;

  constructor(payload: ProtocolSavedEventPayload) {
    super();
    this.payload = plainToInstance(ProtocolSavedEventPayload, payload);
  }
}
