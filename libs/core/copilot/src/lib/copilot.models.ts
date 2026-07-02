import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { FindingKind } from './challenge';

export enum ChallengeFindingKind {
  CONTRADICTS = 'contradicts',
  SUPPORTS = 'supports',
  LOGIC_GAP = 'logic_gap',
  MISSING_STEP = 'missing_step',
}

registerEnumType(ChallengeFindingKind, {
  name: 'ChallengeFindingKind',
  description:
    'The nature of a copilot push-back: a Reference that contradicts/supports ' +
    'the claim, a logic gap, or a missing Protocol step.',
});

// A single grounded push-back. `kind` says how it is grounded; the source
// fields (referenceId/sourceTitle/sourceUrl/quote) are present for
// Reference-grounded findings.
@ObjectType()
export class ChallengeFinding {
  @Field(() => ChallengeFindingKind) kind!: ChallengeFindingKind;
  @Field() summary!: string;
  @Field(() => ID, { nullable: true }) referenceId?: string;
  @Field(() => String, { nullable: true }) sourceTitle?: string;
  @Field(() => String, { nullable: true }) sourceUrl?: string;
  @Field(() => String, { nullable: true }) quote?: string;
}

export function toFindingKind(kind: FindingKind): ChallengeFindingKind {
  return kind as ChallengeFindingKind;
}
