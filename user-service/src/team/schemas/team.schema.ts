// src/team/schemas/team.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeamDocument = Team & Document;

@Schema({timestamps: true})
export class Team {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'SportCategory', required: true })
  sportCategoryId: Types.ObjectId;

  @Prop({ type: String, required: false })
  location?: string;


}

export const TeamSchema = SchemaFactory.createForClass(Team);

TeamSchema.index({ name: 1, sportCategoryId: 1 }, { unique: true });