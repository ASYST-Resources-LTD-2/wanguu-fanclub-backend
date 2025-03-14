import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Abonnement {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  duration: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  // Add other properties as needed
}

export type AbonnementDocument = Abonnement & Document;
export const AbonnementSchema = SchemaFactory.createForClass(Abonnement);
