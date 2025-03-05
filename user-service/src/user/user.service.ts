// src/user/user.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, set, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { Membership, MembershipDocument } from 'src/membership/schemas/membership.schema';
import { ClientKafka } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';

@Injectable()
export class UserService {
  private keycloakAdmin: KeycloakAdminClient;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Membership.name) private membershipModel: Model<MembershipDocument>,
    @Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka,
    private readonly httpService: HttpService,
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
    const maxRetries = 3;
    let attempt = 0;
    let lastError;
    let keycloakUser: { id?: string } | null = null;
  
    while (attempt < maxRetries) {
      try {
        // Check for existing user in MongoDB
        const existingUser = await this.userModel.findOne({ 
          $or: [{ username }, { email }] 
        }).exec();
        if (existingUser) {
          throw new Error('User already exists in MongoDB');
        }
  
        // Authenticate Keycloak admin client
        await this.keycloakAdmin.auth({
          grantType: 'client_credentials',
          clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
          clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
        });
  
        // Check for existing user in Keycloak
        const existingKeycloakUsers = await this.keycloakAdmin.users.find({
          username: username,
          email: email
        });
        if (existingKeycloakUsers.length > 0) {
          throw new Error('User already exists in Keycloak');
        }
  
        // Create user in Keycloak
        const createdKeycloakUser = await this.keycloakAdmin.users.create({
          username,
          email,
          enabled: true,
          credentials: [{ type: 'password', value: password, temporary: false }],
          emailVerified: true,
        });
        keycloakUser = createdKeycloakUser;
  
        if (!keycloakUser?.id) {
          throw new Error('Failed to create Keycloak user');
        }
  
        // Optional: Remove existing realm roles if needed
        const realmRoles = await this.keycloakAdmin.users.listRealmRoleMappings({
          id: keycloakUser.id,
        });
        if (realmRoles.length > 0) {
          await this.keycloakAdmin.users.delRealmRoleMappings({
            id: keycloakUser.id,
            roles: realmRoles.map(role => ({ id: role.id ?? '', name: role.name ?? '' })),
          });
        }
  
        // Fetch the "fanclub-user-membership" client
        const client = await this.keycloakAdmin.clients.find({
          clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
        });
        if (!client?.[0]?.id) {
          throw new Error('Client not found in Keycloak');
        }
        const clientId = client[0].id;
  
        // Fetch the "USER" role from the client
        const roles = await this.keycloakAdmin.clients.listRoles({ id: clientId });
        const userRole = roles.find(role => role.name === 'USER');
        if (!userRole) {
          if (keycloakUser.id) {
            await this.keycloakAdmin.users.del({ id: keycloakUser.id });
          }
          throw new Error('Role "USER" not found in client');
        }
  
        // Assign the "USER" role to the user in Keycloak
        await this.keycloakAdmin.users.addClientRoleMappings({
          id: keycloakUser.id,
          clientUniqueId: clientId,
          roles: [{ id: userRole.id ?? '', name: userRole.name ?? '' }],
        });
  
        // Create user in MongoDB
        const createdUser = new this.userModel({
          username,
          email,
          role: userRole.name,
          keycloakData: {
            keycloakId: keycloakUser.id,
          },
          selectedSports: [],
          teamIds: [],
        });
        const savedUser = await createdUser.save();
  
        // Create membership in MongoDB
        const membership = new this.membershipModel({
          userId: savedUser._id as Types.ObjectId,
          membershipType: 'FREE',
        });
        await membership.save();
  
        // Emit Kafka event
        this.kafkaClient.emit('UserCreated', {
          username,
          email,
          userId: savedUser._id,
        });
  
        return {
          mongoUser: savedUser,
          keycloakUser,
          keycloakUserRole: userRole.name,
          status: 'success',
          message: 'User created successfully',
        };
  
      } catch (error) {
        lastError = error;
        // Rollback: Delete Keycloak user if subsequent steps fail
        if (keycloakUser?.id) {
          try {
            await this.keycloakAdmin.users.del({ id: keycloakUser.id });
          } catch (deleteError) {
            console.error('Failed to delete Keycloak user on error:', deleteError);
          }
        }
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
          attempt++;
          if (attempt < maxRetries) {
            const backoffTime = Math.pow(2, attempt - 1) * 1000;
            console.log(`Retry attempt ${attempt} after ${backoffTime}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
        }
        throw new Error(`User creation failed after ${attempt} attempts. Error: ${lastError.message}`);
      }
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
                    signal,
                },
            );
  
            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                if (errorData.error === 'invalid_grant') {
                    // Invalid credentials, don't retry
                    throw new Error(`Authentication failed: ${errorData.error_description}`);
                } else if (errorData.error === 'unauthorized_client') {
                    // Invalid client credentials, don't retry
                    throw new Error(`Authentication failed: ${errorData.error_description}`);
                } else {
                    // Other errors, retry
                    throw new Error(`Request failed: ${errorData.error_description}`);
                }
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
            if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
                // Retry on ECONNRESET errors
                attempt++;
                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const backoffTime = Math.pow(2, attempt - 1) * 1000;
                    console.log(`Retry attempt ${attempt} after ${backoffTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    continue;
                }
            } else {
                // Non-ECONNRESET errors, don't retry
                break;
            }
        }
    }
  
    // If we get here, all retries failed
    throw new Error(`Authentication failed after ${attempt} attempts. Last error: ${lastError.message}`);
  }


  async upgradeMembership(
    userId: string, // Keycloak UUID
    plan: { price: number; duration: string; startDate: Date; endDate: Date },
    token: string,
): Promise<any> {
    // Find user by Keycloak ID
    const user = await this.userModel.findOne({ 'keycloakData.keycloakId': userId });
    if (!user) {
        throw new Error('User not found');
    }

    const maxRetries = 3;
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
        try {
            // Step 1: Validate the token via Keycloak introspection
            const introspectionUrl = `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'FanClubRealm'}/protocol/openid-connect/token/introspect`;
            const introspectionResponse = await firstValueFrom(
                this.httpService.post(
                    introspectionUrl,
                    new URLSearchParams({
                        token: token,
                        client_id: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
                        client_secret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Connection': 'keep-alive',
                        },
                        timeout: 5000,
                    },
                ),
            );

            const tokenData = introspectionResponse.data;
            if (!tokenData.active) {
                throw new Error('Invalid or expired token');
            }

            // Step 2: Authenticate Keycloak admin client
            await this.keycloakAdmin.auth({
                grantType: 'client_credentials',
                clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
                clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
            });

            // Step 3: Fetch the client ID for "fanclub-user-membership"
            const clients = await this.keycloakAdmin.clients.find({
                clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
            });
            if (!clients || clients.length === 0 || !clients[0].id) {
                throw new Error('Client not found in Keycloak');
            }
            const clientId: string = clients[0].id; // Type assertion or guaranteed by check above

            // Step 4: Fetch the "PREMIUM_USER" role from the client
            const roles = await this.keycloakAdmin.clients.listRoles({ id: clientId });
            const premiumRole = roles.find(role => role.name === 'PREMIUM_USER');
            if (!premiumRole || !premiumRole.id || !premiumRole.name) {
                throw new Error('PREMIUM_USER role not found in client or missing required properties');
            }

            // Step 5: Assign the "PREMIUM_USER" client role in Keycloak
            await this.keycloakAdmin.users.addClientRoleMappings({
                id: userId, // Keycloak UUID
                clientUniqueId: clientId,
                roles: [{ id: premiumRole.id, name: premiumRole.name }], // Now guaranteed to be strings
            });

            // Step 6: Update membership in MongoDB using user._id
            const membership = await this.membershipModel.findOneAndUpdate(
                { userId: user._id },
                {
                    membershipType: 'PREMIUM',
                    upgradeDate: new Date(),
                    subscriptionPlan: { ...plan, isActive: true },
                },
                { new: true },
            );

            if (!membership) {
                throw new Error('Membership not found');
            }

            // Step 7: Update user role in MongoDB
            await this.userModel.findByIdAndUpdate(user._id, {
                role: 'PREMIUM_USER',
            });

            // Step 8: Emit Kafka event with MongoDB ID
            this.kafkaClient.emit('membership-upgraded', {
                userId: user._id as Types.ObjectId,
                membershipType: 'PREMIUM',
            });

            return {
                status: 'success',
                message: 'Membership upgraded to PREMIUM',
                userId: user._id,
                keycloakId: userId,
            };
        } catch (error) {
            lastError = error;

            if (
                error.code === 'ECONNRESET' ||
                error.message.includes('ECONNRESET') ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ECONNREFUSED'
            ) {
                attempt++;
                if (attempt < maxRetries) {
                    const backoffTime = Math.pow(2, attempt - 1) * 1000;
                    console.log(`Retry attempt ${attempt} for membership upgrade after ${backoffTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    continue;
                }
            }

            console.error('Error upgrading membership:', error.message);
            throw new Error(`Membership upgrade failed after ${attempt} attempts. Error: ${lastError.message}`);
        }
    }
}




  





  // async upgradeMembership(
  //   userId: string,
  //   plan: {price: number; duration: string; startDate: Date; endDate: Date},
  //   token: string
  // ): Promise<any> {
  //   // First authenticate with client credentials
  //   await this.keycloakAdmin.auth({
  //     grantType: 'client_credentials',
  //     clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
  //     clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
  //   });
  
  //   // Verify the user token roles before proceeding
  //   const tokenInfo = await axios.post(`${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token/introspect`, 
  //     new URLSearchParams({
  //       token: token || '',
  //       clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
  //       clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
  //       token_type_hint: 'access_token'
  //     }), 
  //     {
  //       headers: {
  //         'Content-Type': 'application/x-www-form-urlencoded'
  //       }
  //     }
  //   );
  
  //   if (!tokenInfo.data.active) {
  //     throw new Error('Invalid or expired token');
  //   }
  
  //   const user = await this.userModel.findById(userId).exec();
  //   if (!user) {
  //     throw new Error('User not found');
  //   }
  
  //   const membership = await this.membershipModel.findOne({ userId: userId }).exec();
  //   if (membership?.membershipType === 'PREMIUM') {
  //     throw new Error('User already has premium membership');
  //   }
  
  //   if(membership) {
  //     membership.membershipType = 'PREMIUM';
  //     membership.upgradeDate = new Date(Date.now());
  //     membership.subscriptionPlan = {...plan, isActive: true};
  //     await membership.save();
  //   }
  
  //   await this.keycloakAdmin.users.addRealmRoleMappings({
  //     id: user.keycloakData.keycloakId,
  //     roles: [{ id: 'PREMIUM_USER', name: 'PREMIUM_USER' }],
  //   });
  
  //   user.role = 'PREMIUM_USER';
  //   await user.save();
  
  //   this.kafkaClient.emit('membership-upgraded', {
  //     userId: userId.toString(),
  //     membershipType: 'PREMIUM',
  //   });
  
  //   return { status: 'success', message: 'Membership upgraded to PREMIUM' };
  // }
  

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