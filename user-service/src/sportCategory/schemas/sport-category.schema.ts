import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class SportCategory {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'SportCategory', default: null })
  parentCategoryId: Types.ObjectId | null;

  @Prop({ required: true })
  path: string;
}

export type SportCategoryDocument = SportCategory & Document;
export const SportCategorySchema = SchemaFactory.createForClass(SportCategory);