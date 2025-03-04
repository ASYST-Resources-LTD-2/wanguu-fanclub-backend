import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: false }) // Password is managed by Keycloak; not stored here
  password?: string;

  @Prop({ type: [Types.ObjectId], ref: 'Sport', default: [] })
  selectedSports: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  teamIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['USER', 'PREMIUM_USER', 'ADMIN', 'TEAM_GESTIONNAIRE']
  })
  role: string

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
}

export const UserSchema = SchemaFactory.createForClass(User);