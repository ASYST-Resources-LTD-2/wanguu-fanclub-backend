import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Sport {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'SportCategory', required: true })
  categoryId: Types.ObjectId;
}

export type SportDocument = Sport & Document;
export const SportSchema = SchemaFactory.createForClass(Sport);
