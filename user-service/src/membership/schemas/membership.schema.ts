// src/membership/schemas/membership.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MembershipDocument = Membership & Document;

@Schema()
export class Membership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['FREE', 'PREMIUM'], default: 'FREE' })
  membershipType: string;

  @Prop({ type: Date, default: null })
  upgradeDate?: Date | null;

  @Prop({ type: Object, default: null })
  subscriptionPlan?: {
    price: number;
    duration: string; // e.g., '1 month', '1 year'
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  };
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);