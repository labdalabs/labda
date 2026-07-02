import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

@ObjectType()
export class Protocol {
  @Field(() => ID) id!: string;
  @Field(() => ID) projectId!: string;
  @Field() title!: string;
  @Field(() => Int) version!: number;
  // The nbformat-4 notebook document as a JSON string (lossless round-trip).
  @Field() notebook!: string;
  @Field() createdAt!: Date;
  @Field() updatedAt!: Date;
}

@InputType()
export class CreateProtocolInput {
  @Field(() => ID)
  @IsUUID()
  projectId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  // Optional starter notebook (nbformat-4 JSON string). When omitted an empty
  // notebook is created. Also used to import an existing `.ipynb`.
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notebook?: string;
}

@InputType()
export class SaveProtocolInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  // Full nbformat-4 notebook JSON string to persist as the next version.
  @Field()
  @IsString()
  @IsNotEmpty()
  notebook!: string;
}

export interface ProtocolDto {
  id: string;
  projectId: string;
  title: string;
  version: number;
  notebook: string;
  createdAt: Date;
  updatedAt: Date;
}
