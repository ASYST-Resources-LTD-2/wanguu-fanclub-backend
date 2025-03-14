import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { ClientGrpc, ClientKafka, GrpcMethod } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { Team } from 'src/team/schemas/team.schema';
import { SportCategory } from 'src/sportCategory/schemas/sport-category.schema';

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
}

interface AbonnementServiceClient {
  getSubscription(data: { userId: string }): any;
  upgradeSubscription(data: { userId: string; duration: string; price: number }): any;
}

@Injectable()
export class UserService {
  private keycloakAdmin: KeycloakAdminClient;
  private abonnementService: AbonnementServiceClient;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Team.name) private teamModel: Model<Team>,
    @InjectModel(SportCategory.name) private sportCategoryModel: Model<SportCategory>,
    @Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka,
    private readonly httpService: HttpService,
    @Inject('ABONNEMENT_SERVICE') private readonly clientGrpc: ClientGrpc,
  ) {
    this.keycloakAdmin = new KeycloakAdminClient({
      baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      realmName: process.env.KEYCLOAK_REALM || 'FanClubRealm',
    });
  }

  async onModuleInit() {
    await this.kafkaClient.connect();
    this.abonnementService = this.clientGrpc.getService<AbonnementServiceClient>('AbonnementService');
  }

  @GrpcMethod('UserService', 'SendMessage')
  async sendMessage(data: { message: string }): Promise<{ response: string }> {
    return { response: `Received message: ${data.message}` };
  }

  @GrpcMethod('UserService', 'GetUser')
  async getUser(data: { userId: string }): Promise<{ id: string; username: string; email: string; role: string }> {
    const user = await this.userModel.findById(data.userId).exec();
    if (!user) throw new Error('User not found');
    return { id: user.id, username: user.username, email: user.email, role: user.role };
  }

  @GrpcMethod('UserService', 'CreateUser')
  async createUserGrpc(data: { username: string; email: string; password: string }): Promise<{ id: string; username: string; email: string; role: string }> {
    const result = await this.createUser(data.username, data.email, data.password);
    return { id: result.mongoUser.id, username: result.mongoUser.username, email: result.mongoUser.email, role: result.mongoUser.role };
  }

  async getUserSubscription(userId: string) {
    return lastValueFrom(this.abonnementService.getSubscription({ userId }));
  }

  async upgradeUserSubscription(userId: string, duration: 'Monthly' | 'Yearly', price: number) {
    return lastValueFrom(this.abonnementService.upgradeSubscription({ userId, duration, price }));
  }

  async findUserByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.userModel.findOne({ 'keycloakData.keycloakId': keycloakId }).exec();
  }

  async getUserProfile(userId: string): Promise<User> {
    const user = await this.userModel
      .findById(userId)
      .populate('selectedTeamIds selectedSports abonnementId paymentId')
      .exec();
    if (!user) throw new Error('User not found');
    return user;
  }

  async createUser(
    username: string,
    email: string,
    password: string,
    selectedSports: string[] = [],
    selectedTeamIds: string[] = [],
    notificationPreferences: NotificationPreferences = { email: true, sms: false },
    teamId?: string,
    role: string = 'USER',
    abonnementId?: string,
    paymentId?: string,
  ): Promise<any> {
    const isValidObjectId = (id: string) => Types.ObjectId.isValid(id);

    if (selectedTeamIds.length > 3) throw new Error('Cannot select more than 3 teams');
    if (selectedTeamIds.length > 0 && !selectedTeamIds.every(isValidObjectId)) throw new Error('Invalid ObjectId in selectedTeamIds');
    if (teamId && !isValidObjectId(teamId)) throw new Error('Invalid teamId');
    if (abonnementId && !isValidObjectId(abonnementId)) throw new Error('Invalid abonnementId');
    if (paymentId && !isValidObjectId(paymentId)) throw new Error('Invalid paymentId');

    let derivedSelectedSports: string[] = [];
    if (selectedTeamIds.length > 0) {
      const teams = await this.teamModel.find({ _id: { $in: selectedTeamIds.map(id => new Types.ObjectId(id)) } });
      if (teams.length !== selectedTeamIds.length) throw new Error('One or more team IDs do not exist');
      derivedSelectedSports = [...new Set(teams.map(team => team.sportCategoryId.toString()))];
      const sportCategories = await this.sportCategoryModel.find({ _id: { $in: derivedSelectedSports.map(id => new Types.ObjectId(id)) } });
      if (sportCategories.length !== derivedSelectedSports.length) throw new Error('One or more sport categories are invalid');
    }

    const maxRetries = 5;
    let attempt = 0;
    let lastError;
    let keycloakUserId: string | null = null;

    while (attempt < maxRetries) {
      try {
        const existingUser = await this.userModel.findOne({ $or: [{ username }, { email }] }).exec();
        if (existingUser) throw new Error('User already exists in MongoDB');

        await this.keycloakAdmin.auth({
          grantType: 'client_credentials',
          clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
          clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
        });

        const existingKeycloakUsers = await this.keycloakAdmin.users.find({ username, email });
        if (existingKeycloakUsers.length > 0) throw new Error('User already exists in Keycloak');

        const createdKeycloakUser = await this.keycloakAdmin.users.create({
          username, email, enabled: true, credentials: [{ type: 'password', value: password, temporary: false }], emailVerified: true,
        });
        keycloakUserId = createdKeycloakUser.id;
        if (!keycloakUserId) throw new Error('Failed to create Keycloak user');

        const client = await this.keycloakAdmin.clients.find({ clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership' });
        if (!client?.[0]?.id) throw new Error('Client not found in Keycloak');
        const clientId = client[0].id;

        const roles = await this.keycloakAdmin.clients.listRoles({ id: clientId });
        let selectedRole = roles.find(r => r.name === role);
        if (!selectedRole) {
          await this.keycloakAdmin.users.del({ id: keycloakUserId });
          throw new Error(`Role "${role}" not found in client`);
        }
        await this.keycloakAdmin.users.addClientRoleMappings({
          id: keycloakUserId, clientUniqueId: clientId, roles: [{ id: selectedRole.id ?? '', name: selectedRole.name ?? '' }],
        });

        const newUser = new this.userModel({
          username, email, membershipStatus: 'INACTIVE', membershipBadge: 'Basic', selectedSports: derivedSelectedSports.map(id => new Types.ObjectId(id)),
          selectedTeamIds: selectedTeamIds.map(id => new Types.ObjectId(id)), notificationPreferences, role: selectedRole.name,
          teamId: teamId ? new Types.ObjectId(teamId) : null, keycloakData: { keycloakId: keycloakUserId },
          abonnementId: abonnementId ? new Types.ObjectId(abonnementId) : null,
          paymentId: paymentId ? new Types.ObjectId(paymentId) : null,
        });
        const savedUser = await newUser.save();

        this.kafkaClient.emit('UserCreated', {
          username, email, userId: savedUser._id, role: selectedRole.name, membershipStatus: 'INACTIVE', membershipBadge: 'Basic',
          selectedSports: derivedSelectedSports, selectedTeamIds,
        });

        return { mongoUser: savedUser, keycloakUserId, keycloakUserRole: selectedRole.name, status: 'success', message: 'User created successfully' };
      } catch (error) {
        lastError = error;
        if (keycloakUserId) try { await this.keycloakAdmin.users.del({ id: keycloakUserId }); } catch (deleteError) { console.error(deleteError); }
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
          attempt++; if (attempt < maxRetries) { const backoffTime = Math.pow(2, attempt - 1) * 1000; console.log(`Retry ${attempt} after ${backoffTime}ms`); await new Promise(resolve => setTimeout(resolve, backoffTime)); continue; }
        }
        throw new Error(`User creation failed after ${attempt} attempts. Error: ${lastError.message}`);
      }
    }
  }

  async updateUserProfile(userId: string, updateData: Partial<User>): Promise<User> {
    const restrictedFields = ['role', 'membershipStatus', 'keycloakData'];
    Object.keys(updateData).forEach(key => restrictedFields.includes(key) && delete updateData[key]);

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new Error('User not found');

    await this.keycloakAdmin.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
    });

    if (updateData.email || updateData.username) {
      await this.keycloakAdmin.users.update({ id: user.keycloakData.keycloakId }, { email: updateData.email, username: updateData.username, emailVerified: true });
    }

    const result = await this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).lean().exec();
    if (!result) throw new Error('Failed to update user');

    this.kafkaClient.emit('UserProfileUpdated', { userId, updates: updateData });
    return result as User;
  }

  async getAllUsers(): Promise<UserDocument[]> {
    try {
      return await this.userModel.find().select('-password -keycloakData').populate('selectedTeamIds selectedSports abonnementId paymentId').exec();
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  async checkUserExists(userId: string): Promise<boolean> {
    try {
      if (!userId) throw new Error('User ID is required');
      return (await this.userModel.findById(userId).exec()) !== null;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  async deleteUser(userId: string, authenticatedUserId: string, isAdmin: boolean): Promise<void> {
    const user = await this.userModel.findById(userId).exec() as UserDocument;
    if (!user) throw new Error('User not found');

    if (user.id !== authenticatedUserId && !isAdmin) throw new Error('Unauthorized');

    try {
      await this.keycloakAdmin.auth({
        grantType: 'client_credentials',
        clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
      });

      await this.keycloakAdmin.users.del({ id: user.keycloakData.keycloakId });
      await this.userModel.findByIdAndDelete(userId).exec();

      this.kafkaClient.emit('UserDeleted', { userId, deletedBy: authenticatedUserId, isAdminDeletion: isAdmin });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
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
    setTimeout(() => controller.abort(), 5000);

    while (attempt < maxRetries) {
      try {
        const tokenResponse = await fetch(`${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'FanClubRealm'}/protocol/openid-connect/token`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Connection': 'keep-alive' },
          body: new URLSearchParams({ grant_type: 'password', client_id: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership', client_secret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT', username, password }).toString(),
          signal: controller.signal,
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          if (errorData.error === 'invalid_grant') throw new Error(`Authentication failed: ${errorData.error_description}`);
          throw new Error(`Request failed: ${errorData.error_description}`);
        }

        const tokenData = await tokenResponse.json();
        const user = await this.userModel.findOne({ username }).exec();
        if (!user) throw new Error('User not found in database');

        return { mongoUser: user, tokens: tokenData, status: 'success', message: 'User authenticated successfully' };
      } catch (error) {
        lastError = error;
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
          attempt++; if (attempt < maxRetries) { const backoffTime = Math.pow(2, attempt - 1) * 1000; console.log(`Retry ${attempt} after ${backoffTime}ms`); await new Promise(resolve => setTimeout(resolve, backoffTime)); continue; }
        }
        break;
      }
    }
    throw new Error(`Authentication failed after ${attempt} attempts. Last error: ${lastError.message}`);
  }

  async updateSelectedTeams(userId: string, newSelectedTeamIds: string[]): Promise<any> {
    if (newSelectedTeamIds.length > 3) throw new Error('Cannot select more than 3 teams');

    const user = await this.userModel.findById(userId);
    if (!user) throw new Error('User not found');

    const teams = await this.teamModel.find({ _id: { $in: newSelectedTeamIds.map(id => new Types.ObjectId(id)) } });
    if (teams.length !== newSelectedTeamIds.length) throw new Error('One or more team IDs are invalid');

    const uniqueSportCategories = [...new Set(teams.map(team => team.sportCategoryId.toString()))];
    const sportCategories = await this.sportCategoryModel.find({ _id: { $in: uniqueSportCategories.map(id => new Types.ObjectId(id)) } });
    if (sportCategories.length !== uniqueSportCategories.length) throw new Error('One or more sport categories are invalid');

    await this.keycloakAdmin.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
    });

    const updates = {
      selectedTeamIds: newSelectedTeamIds.map(id => new Types.ObjectId(id)),
      selectedSports: uniqueSportCategories.map(id => new Types.ObjectId(id)),
    };

    const updatedUser = await this.userModel.findByIdAndUpdate(userId, { $set: updates }, { new: true });
    if (!updatedUser) throw new Error('Failed to update user preferences');

    this.kafkaClient.emit('UserTeamsUpdated', {
      userId, selectedTeamIds: newSelectedTeamIds, selectedSports: uniqueSportCategories,
      teamsWithSports: teams.map(team => ({ teamId: team._id, sportCategoryId: team.sportCategoryId })),
    });

    return {
      status: 'success', message: 'Selected teams and sports updated successfully',
      selectedTeamIds: updatedUser.selectedTeamIds, selectedSports: updatedUser.selectedSports,
      teamsWithSports: teams.map(team => ({ teamId: team._id, sportCategoryId: team.sportCategoryId })),
    };
  }

  async upgradeMembership(userId: string, body: { duration: 'Monthly' | 'Yearly'; price?: number }, token: string): Promise<any> {
    const user = await this.userModel.findOne({ 'keycloakData.keycloakId': userId });
    if (!user) throw new Error('User not found');

    const maxRetries = 5;
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
      try {
        const introspectionUrl = `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'FanClubRealm'}/protocol/openid-connect/token/introspect`;
        const introspectionResponse = await firstValueFrom(this.httpService.post(introspectionUrl, new URLSearchParams({
          token, client_id: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership', client_secret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Connection': 'keep-alive' }, timeout: 5000 }));

        if (!introspectionResponse.data.active) throw new Error('Invalid or expired token');

        await this.keycloakAdmin.auth({
          grantType: 'client_credentials',
          clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
          clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
        });

        const clients = await this.keycloakAdmin.clients.find({ clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership' });
        if (!clients?.[0]?.id) throw new Error('Client not found in Keycloak');
        const clientId = clients[0].id;

        const roles = await this.keycloakAdmin.clients.listRoles({ id: clientId });
        const premiumRole = roles.find(role => role.name === 'PREMIUM_USER');
        if (!premiumRole) throw new Error('PREMIUM_USER role not found');

        await this.keycloakAdmin.users.addClientRoleMappings({ id: userId, clientUniqueId: clientId, roles: [{ id: premiumRole.id ?? '', name: premiumRole.name ?? '' }] });

        const startDate = new Date();
        let endDate = new Date(startDate);
        const price = body.price || (body.duration === 'Monthly' ? 29.99 : 129.99);
        if (body.duration === 'Monthly') endDate.setMonth(endDate.getMonth() + 1);
        else if (body.duration === 'Yearly') endDate.setFullYear(endDate.getFullYear() + 1);

        user.membershipStatus = 'ACTIVE';
        user.membershipBadge = 'Premium';
        user.role = 'PREMIUM_USER';
        user.subscriptionPlan = { price, duration: body.duration, startDate, endDate, isActive: true };
        await user.save();

        this.kafkaClient.emit('membership-upgraded', { userId: user._id, membershipType: 'PREMIUM', duration: body.duration });

        return {
          status: 'success', message: `Membership upgraded to PREMIUM for ${body.duration}`,
          userId: user._id, keycloakId: userId, subscriptionPlan: user.subscriptionPlan,
        };
      } catch (error) {
        lastError = error;
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET') || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
          attempt++; if (attempt < maxRetries) { const backoffTime = Math.pow(2, attempt - 1) * 1000; console.log(`Retry ${attempt} after ${backoffTime}ms`); await new Promise(resolve => setTimeout(resolve, backoffTime)); continue; }
        }
        throw new Error(`Membership upgrade failed after ${attempt} attempts. Error: ${lastError.message}`);
      }
    }
  }

  async updateSportCategoryPreferences(userId: string, sportCategoryIds: string[]): Promise<any> {
    if (sportCategoryIds.length > 5) throw new Error('Cannot select more than 5 sport categories');

    const user = await this.userModel.findById(userId);
    if (!user) throw new Error('User not found');

    const validSportCategories = await this.sportCategoryModel.find({ _id: { $in: sportCategoryIds.map(id => new Types.ObjectId(id)) } });
    if (validSportCategories.length !== sportCategoryIds.length) throw new Error('One or more sport categories are invalid');

    const updates = { selectedSports: sportCategoryIds.map(id => new Types.ObjectId(id)) };
    const updatedUser = await this.userModel.findByIdAndUpdate(userId, { $set: updates }, { new: true });
    if (!updatedUser) throw new Error('Failed to update sport category preferences');

    this.kafkaClient.emit('UserSportCategoriesUpdated', { userId, sportCategoryIds });

    return {
      status: 'success', message: 'Sport category preferences updated successfully',
      selectedSports: updatedUser.selectedSports,
    };
  }

  // async getSportCategoryHierarchy(sportCategoryId: string): Promise<any> {
  //   const category = await this.sportCategoryModel.findById(sportCategoryId).exec();
  //   if (!category) throw new Error('Sport category not found');
  
  //   const hierarchy = await this.buildSportCategoryHierarchy(category);
  //   return { status: 'success', hierarchy };
  // }

  async getSportCategoryHierarchy(sportCategoryId: string): Promise<any> {
    const category = await this.sportCategoryModel.findById(sportCategoryId).exec();
    if (!category) throw new Error('Sport category not found');
    
    const hierarchy = await this.buildSportCategoryHierarchy(category);
    return { status: 'success', hierarchy };
  }

  // private async buildSportCategoryHierarchy(category: any): Promise<any> {
  //   const subCategories = await this.sportCategoryModel.find({ parentCategoryId: category._id }).exec();
  //   const result = { ...category.toJSON(), subCategories: [] };
  //   for (const sub of subCategories) {
  //     result.subCategories.push(await this.buildSportCategoryHierarchy(sub));
  //   }
  //   return result;
  // }

  async linkPaymentToUser(userId: string, paymentId: string, abonnementId: string): Promise<any> {
    const isValidObjectId = (id: string) => Types.ObjectId.isValid(id);
    if (!isValidObjectId(paymentId) || !isValidObjectId(abonnementId)) throw new Error('Invalid paymentId or abonnementId');

    const user = await this.userModel.findById(userId);
    if (!user) throw new Error('User not found');

    user.paymentId = new Types.ObjectId(paymentId);
    user.abonnementId = new Types.ObjectId(abonnementId);
    await user.save();

    this.kafkaClient.emit('UserPaymentLinked', { userId, paymentId, abonnementId });

    return { status: 'success', message: 'Payment and subscription linked successfully' };
  }

  async assignGestionnaireRole(userId: string, teamId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new Error('User not found');
    await this.keycloakAdmin.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
    });
    await this.keycloakAdmin.users.addRealmRoleMappings({
      id: user.keycloakData.keycloakId, roles: [{ id: 'TEAM_GESTIONNAIRE', name: 'TEAM_GESTIONNAIRE' }],
    });
    user.role = 'TEAM_GESTIONNAIRE';
    user.teamId = new Types.ObjectId(teamId);
    await user.save();
    this.kafkaClient.emit('role-assigned', { userId: user._id, role: 'TEAM_GESTIONNAIRE' });
    return { status: 'success', message: 'Gestionnaire role assigned' };
  }

  async assignAdminRole(userId: string): Promise<any> {
    const maxRetries = 5;
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
      try {
        const user = await this.userModel.findById(userId).exec();
        if (!user) throw new Error('User not found');

        await this.keycloakAdmin.auth({
          grantType: 'client_credentials',
          clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
          clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
        });

        const clients = await this.keycloakAdmin.clients.find({ clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership' });
        if (!clients[0]?.id) throw new Error('Client not found in Keycloak');
        const clientId = clients[0].id;

        const roles = await this.keycloakAdmin.clients.listRoles({ id: clientId });
        const adminRole = roles.find(role => role.name === 'ADMIN');
        if (!adminRole) throw new Error('ADMIN role not found');

        await this.keycloakAdmin.users.addClientRoleMappings({
          id: user.keycloakData.keycloakId, clientUniqueId: clientId, roles: [{ id: adminRole.id ?? '', name: adminRole.name ?? '' }],
        });

        user.role = 'ADMIN';
        await user.save();

        this.kafkaClient.emit('role-assigned', { userId: user._id, role: 'ADMIN' });

        return { status: 'success', message: 'Admin role assigned successfully' };
      } catch (error) {
        lastError = error;
        attempt++;
      }
    }
    throw lastError;
  }

  // private async buildSportCategoryHierarchy(category: any): Promise<any> {
  //   const subCategories = await this.sportCategoryModel.find({ parentCategoryId: category._id }).exec();
    
  //   // Convert to a plain JavaScript object to preserve all fields
  //   const result = category.toObject ? category.toObject() : JSON.parse(JSON.stringify(category));
    
  //   // Ensure _id is properly converted to string
  //   if (result._id) {
  //     result._id = result._id.toString();
  //   }
    
  //   // Ensure parentCategoryId is properly converted to string if it exists
  //   if (result.parentCategoryId) {
  //     result.parentCategoryId = result.parentCategoryId.toString();
  //   }
    
  //   // Initialize subCategories array
  //   result.subCategories = [];
    
  //   // Process each subcategory
  //   for (const sub of subCategories) {
  //     result.subCategories.push(await this.buildSportCategoryHierarchy(sub));
  //   }
    
  //   return result;
  // }



  private async buildSportCategoryHierarchy(category: any): Promise<any> {
    const subCategories = await this.sportCategoryModel.find({ parentCategoryId: category._id }).exec();
    
    // Convert to a plain JavaScript object
    const result = category.toObject ? category.toObject() : JSON.parse(JSON.stringify(category));
    
    // Ensure all fields are properly typed and converted
    result.id = result._id.toString();                // Map _id to id for proto
    delete result._id;                                // Remove original _id
    result.parentCategoryId = result.parentCategoryId ? result.parentCategoryId.toString() : null;
    result.createdAt = result.createdAt.toISOString(); // Convert dates to ISO strings
    result.updatedAt = result.updatedAt.toISOString();
    result.version = result.__v;                      // Map __v to version
    delete result.__v;                                // Remove original __v
    
    // Recursively build subcategories
    result.subCategories = await Promise.all(
      subCategories.map(sub => this.buildSportCategoryHierarchy(sub))
    );
    
    return result;
  }
  
  

}