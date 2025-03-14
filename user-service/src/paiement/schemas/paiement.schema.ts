import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaiementDocument = Paiement & Document;

@Schema({ timestamps: true })
export class Paiement {
  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  paymentDate: Date;

  @Prop({ type: Object, default: null })
  paymentDetails?: Record<string, any>;
}

export const PaiementSchema = SchemaFactory.createForClass(Paiement);
