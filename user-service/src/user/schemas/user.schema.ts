import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
}

interface SubscriptionPlan {
  price: number;
  duration: string; // Stored for reference, e.g., "Monthly" or "Yearly"
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: false }) // Password is managed by Keycloak; not stored here
  password?: string;

  @Prop({ type: String, required: true, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' })
  membershipStatus: string;

  @Prop({ 
    type: String, 
    enum: ['Basic', 'Premium'],
    default: 'Basic'
  })
  membershipBadge: string;

  @Prop({ type: [Types.ObjectId], ref: 'Sport', default: [] })
  selectedSports: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Team' }] })
  selectedTeamIds: Types.ObjectId[];

  @Prop({ type: Object })
  notificationPreferences: NotificationPreferences;

  @Prop({
    type: String,
    enum: ['USER', 'PREMIUM_USER', 'ADMIN', 'TEAM_GESTIONNAIRE', 'default-roles-fanclubrealm'],
    default: 'USER'
  })
  role: string;

  @Prop({ type: Types.ObjectId, ref: 'Team', default: null })
  teamId?: Types.ObjectId | null;

  @Prop({ type: Object, default: null }) // Store Keycloak user ID and tokens
  keycloakData: {
    keycloakId: string;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    tokenExpiresAt?: Date;
    refreshTokenExpiresAt?: Date;
  };

  @Prop({ type: Object, default: null })
  subscriptionPlan?: SubscriptionPlan;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);