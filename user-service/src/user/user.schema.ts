import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: false }) // Password is managed by Keycloak; not stored here
  password: string;

  @Prop({ type: [String], default: [] })
  selectedSports: string[];

  @Prop({ type: [String], default: [] })
  teamIds: string[];

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