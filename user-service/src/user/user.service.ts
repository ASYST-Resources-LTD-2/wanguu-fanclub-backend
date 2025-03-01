// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';

@Injectable()
export class UserService {
  private keycloakAdmin: KeycloakAdminClient;

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
    this.keycloakAdmin = new KeycloakAdminClient({
      baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      realmName: process.env.KEYCLOAK_REALM || 'FanClubRealm',
    });
  }

  async createUser(username: string, email: string, password: string): Promise<any> {
    try {
      // Authenticate with Keycloak using client credentials
      await this.keycloakAdmin.auth({
        grantType: 'client_credentials',
        clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
      });
      console.log('Successfully authenticated with Keycloak');

      // Create user in Keycloak
      const keycloakUser = await this.keycloakAdmin.users.create({
        username,
        email,
        enabled: true,
        credentials: [{ type: 'password', value: password, temporary: false }],
        emailVerified: true,
      });
      console.log('User created in Keycloak:', keycloakUser);

      // Fetch Keycloak user details
      const keycloakUserDetails = await this.keycloakAdmin.users.findOne({
        id: keycloakUser.id,
        realm: process.env.KEYCLOAK_REALM || 'FanClubRealm',
      });
      console.log('Fetched Keycloak user details:', keycloakUserDetails);

      // Create user in MongoDB
      const createdUser = new this.userModel({
        username,
        email,
        keycloakData: {
          keycloakId: keycloakUser.id,
        },
        selectedSports: [],
        teamIds: [],
      });
      const savedUser = await createdUser.save();
      console.log('User saved in MongoDB:', savedUser);

      return {
        mongoUser: savedUser,
        keycloakUser: keycloakUserDetails,
        status: 'success',
        message: 'User created successfully',
      };
    } catch (error) {
      console.error('Error in createUser:', error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Keycloak server is not available');
      } else if (error.response?.status === 403) {
        throw new Error('Forbidden: Check Keycloak client permissions');
      }
      throw error;
    }
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async authenticateUser(username: string, password: string): Promise<any> {
    try {
      // Request token from Keycloak using password grant type
      const tokenResponse = await fetch(
        `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${
          process.env.KEYCLOAK_REALM || 'FanClubRealm'
        }/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
            client_secret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
            username,
            password,
          }).toString(),
        },
      );

      // Check if the response is successful
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Keycloak authentication failed:', errorData);
        throw new Error(`Authentication failed: ${errorData.error_description || 'Unknown error'}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token received from Keycloak:', tokenData);

      // Calculate token expiration times
      const accessTokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      const refreshTokenExpiresAt = tokenData.refresh_expires_in
        ? new Date(Date.now() + tokenData.refresh_expires_in * 1000)
        : undefined;

      // Find user in MongoDB
      let user = await this.userModel.findOne({ username }).exec();
      if (!user) {
        console.log(`User ${username} not found in MongoDB`);
        throw new Error('User not found in database');
      }

      // Update user with token details
      user.keycloakData = {
        ...user.keycloakData,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
        tokenExpiresAt: accessTokenExpiresAt,
        refreshTokenExpiresAt: refreshTokenExpiresAt,
      };

      await user.save();
      console.log('User updated in MongoDB with token data:', user);

      return {
        mongoUser: user,
        tokens: tokenData,
        status: 'success',
        message: 'User authenticated successfully',
      };
    } catch (error) {
      console.error('Error in authenticateUser:', error.message);
      throw error;
    }
  }
}