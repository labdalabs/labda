import { Type } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { DomainEvent } from '@labda/core-common';

// ─── ProjectCreated ──────────────────────────────────────────────────────────

export class ProjectCreatedEventPayload {
  @IsUUID() projectId!: string;
  @IsString() ownerId!: string;
  @IsString() title!: string;
}

export class ProjectCreatedEvent extends DomainEvent<ProjectCreatedEventPayload> {
  static readonly type = 'ProjectCreated';
  readonly eventType = ProjectCreatedEvent.type;

  @ValidateNested()
  @Type(() => ProjectCreatedEventPayload)
  readonly payload: ProjectCreatedEventPayload;

  constructor(payload: ProjectCreatedEventPayload) {
    super();
    this.payload = plainToInstance(ProjectCreatedEventPayload, payload);
  }
}

// ─── HypothesisAdded ─────────────────────────────────────────────────────────

export class HypothesisAddedEventPayload {
  @IsUUID() hypothesisId!: string;
  @IsUUID() projectId!: string;
  @IsString() ownerId!: string;
  @IsString() statement!: string;
  @IsOptional() @IsString() rationale?: string;
}

export class HypothesisAddedEvent extends DomainEvent<HypothesisAddedEventPayload> {
  static readonly type = 'HypothesisAdded';
  readonly eventType = HypothesisAddedEvent.type;

  @ValidateNested()
  @Type(() => HypothesisAddedEventPayload)
  readonly payload: HypothesisAddedEventPayload;

  constructor(payload: HypothesisAddedEventPayload) {
    super();
    this.payload = plainToInstance(HypothesisAddedEventPayload, payload);
  }
}

// ─── ReferenceAttached ───────────────────────────────────────────────────────

export class ReferenceAttachedEventPayload {
  @IsUUID() referenceId!: string;
  @IsUUID() hypothesisId!: string;
  @IsString() ownerId!: string;
  @IsString() title!: string;
}

export class ReferenceAttachedEvent extends DomainEvent<ReferenceAttachedEventPayload> {
  static readonly type = 'ReferenceAttached';
  readonly eventType = ReferenceAttachedEvent.type;

  @ValidateNested()
  @Type(() => ReferenceAttachedEventPayload)
  readonly payload: ReferenceAttachedEventPayload;

  constructor(payload: ReferenceAttachedEventPayload) {
    super();
    this.payload = plainToInstance(ReferenceAttachedEventPayload, payload);
  }
}
