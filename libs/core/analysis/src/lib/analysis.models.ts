import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

@ObjectType()
export class Analysis {
  @Field(() => ID) id!: string;
  @Field(() => ID) protocolId!: string;
  @Field() name!: string;
  // { columns, rows } as a JSON string.
  @Field() inputData!: string;
  // { stats, chart } as a JSON string.
  @Field() results!: string;
  @Field() createdAt!: Date;
}

@ObjectType()
export class AnalysisExport {
  // Short-lived signed URL to the generated `.xlsx` in Supabase Storage.
  @Field() url!: string;
  @Field() path!: string;
}

@InputType()
export class RunAnalysisInput {
  @Field(() => ID)
  @IsUUID()
  protocolId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  // Dataset as a JSON string: { "columns": string[], "rows": number[][] }.
  @Field()
  @IsString()
  @IsNotEmpty()
  data!: string;
}

export interface AnalysisDto {
  id: string;
  protocolId: string;
  name: string;
  inputData: string;
  results: string;
  createdAt: Date;
}
