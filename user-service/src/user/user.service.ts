// src/user/user.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, set, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { Membership, MembershipDocument } from 'src/membership/schemas/membership.schema';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class UserService {
  private keycloakAdmin: KeycloakAdminClient;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Membership.name) private membershipModel: Model<MembershipDocument>,
    @Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka,
) {
    this.keycloakAdmin = new KeycloakAdminClient({
      baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      realmName: process.env.KEYCLOAK_REALM || 'FanClubRealm',
    });
  }

  

  async onModuleInit(){
    await this.kafkaClient.connect();
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
        realmRoles: ['USER'],
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
        role: 'USER',
        keycloakData: {
          keycloakId: keycloakUser.id,
        },
        selectedSports: [],
        teamIds: [],
      });
      const savedUser = await createdUser.save();
      console.log('User saved in MongoDB:', savedUser);

      const membership = new this.membershipModel({
        userId: savedUser._id as Types.ObjectId,
        membershipType: 'FREE',
      });
      await membership.save();

      this.kafkaClient.emit('UserCreated', {
        username,
        email,
        userId: savedUser._id

      });

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
    const maxRetries = 3;
    let attempt = 0;
    let lastError;

    const controller = new AbortController();
    const signal = controller.signal;

    setTimeout(() => {
        controller.abort();
    }, 5000);

    while (attempt < maxRetries) {
        try {
            const tokenResponse = await fetch(
                `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${
                    process.env.KEYCLOAK_REALM || 'FanClubRealm'
                }/protocol/openid-connect/token`,
                {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Connection': 'keep-alive'
                    },
                    body: new URLSearchParams({
                        grant_type: 'password',
                        client_id: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
                        client_secret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
                        username,
                        password,
                    }).toString(),
                    signal,// 5 second timeout
                },
            );

            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                // Don't retry on authentication failures
                if (errorData.error === 'invalid_grant') {
                    throw new Error(`Authentication failed: ${errorData.error_description}`);
                }
                throw new Error(`Request failed: ${errorData.error_description}`);
            }

            // Rest of your successful authentication logic...
            const tokenData = await tokenResponse.json();
            const user = await this.userModel.findOne({ username }).exec();
            if (!user) {
                throw new Error('User not found in database');
            }

            // If we get here, authentication succeeded
            return {
                mongoUser: user,
                tokens: tokenData,
                status: 'success',
                message: 'User authenticated successfully',
            };

        } catch (error) {
            lastError = error;
            
            // Only retry on network-related errors
            if (error.name === 'TypeError' || error.message.includes('network') || error.message.includes('timeout')) {
                attempt++;
                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const backoffTime = Math.pow(2, attempt - 1) * 1000;
                    console.log(`Retry attempt ${attempt} after ${backoffTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    continue;
                }
            } else {
                // Non-network errors should not retry
                break;
            }
        }
    }

    // If we get here, all retries failed
    throw new Error(`Authentication failed after ${attempt} attempts. Last error: ${lastError.message}`);
}


  async  upgradeMembership(
    userId: string,
    plan: {price: number; duration: string; startDate: Date; endDate: Date},
  ): Promise<any>{

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('User not found');
    }
    const membership = await this.membershipModel.findOne({ userId: userId }).exec();
    if(membership){
      membership.membershipType = 'PREMIUM';
      membership.upgradeDate = new Date(Date.now());
      membership.subscriptionPlan = {...plan, isActive: true};
      await membership.save();
    }

    await this.keycloakAdmin.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
    });
    await this.keycloakAdmin.users.addRealmRoleMappings({
      id: user.keycloakData.keycloakId,
      roles: [{ id: 'PREMIUM_USER', name: 'PREMIUM_USER' }],
    });

    user.role = 'PREMIUM_USER';
    await user.save();

    this.kafkaClient.emit('membership-upgraded',{
      userId: userId.toString(),
      membershipType: 'PREMIUM',
      
    });

    return { status: 'success', message: 'Membership upgraded to PREMIUM' };

  }

  async assignGestionnaireRole(userId: string, teamId: string): Promise<any>{

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('User not found');
    }
    await this.keycloakAdmin.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
    });
    await this.keycloakAdmin.users.addRealmRoleMappings({
      id: user.keycloakData.keycloakId,
      roles: [{ id: 'TEAM_GESTIONNAIRE', name: 'TEAM_GESTIONNAIRE' }],
    });
  user.role = 'TEAM_GESTIONNAIRE';
  user.teamId = new Types.ObjectId(teamId);
  await user.save();

  this.kafkaClient.emit('role-assigned',{
    userId: user._id,
    role: 'TEAM_GESTIONNAIRE'
  });
  return { status: 'success', message: 'Gestionnaire role assigned' };
  }

  





}