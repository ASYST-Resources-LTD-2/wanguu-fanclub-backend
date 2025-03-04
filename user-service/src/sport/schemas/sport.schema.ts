// src/sport/schemas/sport.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SportDocument = Sport & Document;

@Schema()
export class Sport {
  @Prop({ required: true, unique: true })
  name: string;
}

export const SportSchema = SchemaFactory.createForClass(Sport);