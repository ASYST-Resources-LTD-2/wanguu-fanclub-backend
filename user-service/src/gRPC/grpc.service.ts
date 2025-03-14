import { Injectable, BadRequestException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TeamService } from '../team/TeamService';
import { SportCategoryService } from '../sportCategory/SportCategoryService';
import { UserDocument } from '../user/schemas/user.schema';
import { TeamDocument } from '../team/schemas/team.schema';


// Define request interfaces (aligned with users.proto)
interface UserRequest {
  userId: string;
}

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  selectedTeamIds: string[];
  notificationPreferences: { email: boolean; sms: boolean };
}

interface UpgradeMembershipRequest {
  userId: string;
  duration: 'Monthly' | 'Yearly';
  price?: number;
  token: string;
}

// Define response interfaces (aligned with users.proto)
interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  membershipStatus: string;
  membershipBadge: string;
  selectedTeamIds: string[];
  selectedSports: string[];
}

interface UserTeamsResponse {
  teams: Array<{
    id: string;
    name: string;
    sportCategoryId: string;
    location: string;
  }>;
}

interface CreateUserResponse {
  status: string;
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

interface UpgradeMembershipResponse {
  status: string;
  message: string;
  subscriptionPlan: {
    price: number;
    duration: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
}

interface PingResponse {
  message: string;
}

interface GetAllUsersResponse {
  users: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    membershipStatus: string;
    membershipBadge: string;
    selectedTeamIds: string[];
    selectedSports: string[];
  }>;
}
interface TeamsList {
  teams: Array<{
    id: string;
    name: string;
    sportCategoryId: string;
    location: string;
  }>;
}

interface UserExistsResponse {
  exists: boolean;
}
interface UpdateUserProfileRequest {
  userId: string;
  username?: string;
  email?: string;
  notificationPreferences?: { email: boolean; sms: boolean };
}

interface DeleteUserRequest {
  userId: string;
  authenticatedUserId: string;
  isAdmin: boolean;
}

interface StatusResponse {
  status: string;
  message: string;
}

interface UpdateSportCategoryRequest {
  userId: string;
  sportCategoryIds: string[];
}

interface SportCategoryRequest {
  sportCategoryId: string;
}



interface LinkPaymentRequest {
  userId: string;
  paymentId: string;
  abonnementId: string;
}

interface AssignRoleRequest {
  userId: string;
  teamId: string;
}
interface UserResponse {
  status: string;
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    membershipStatus: string;
    membershipBadge: string;
    selectedTeamIds: string[];
    selectedSports: string[];
  };
}

interface SportCategoryHierarchyResponse {
  status: string;
  hierarchy: {
    _id: string;
    name: string;
    description: string;
    parentCategoryId: string | null;
    path: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
    subCategories: Array<{
      _id: string;
      name: string;
      description: string;
      parentCategoryId: string;
      path: string;
      createdAt: string;
      updatedAt: string;
      __v: number;
      subCategories: Array<any>;
    }>;
  };
}


@Injectable()
export class GrpcService {
  constructor(
    private readonly userService: UserService,
    private readonly teamService: TeamService,
    private readonly sportCategoryService: SportCategoryService,
  ) {}

  async getAllUsers(): Promise<GetAllUsersResponse> {
    const users = await this.userService.getAllUsers();
    return {
      users: users.map(user => ({
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        membershipStatus: user.membershipStatus,
        membershipBadge: user.membershipBadge,
        selectedTeamIds: user.selectedTeamIds?.map(id => id.toString()) || [],
        selectedSports: user.selectedSports?.map(id => id.toString()) || []
      }))
    };
  }

  async getUserProfile(userId: string, context: any): Promise<UserProfileResponse> {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      const user = await this.userService.getUserProfile(userId) as UserDocument;
      
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        membershipStatus: user.membershipStatus,
        membershipBadge: user.membershipBadge,
        selectedTeamIds: user.selectedTeamIds?.map(id => id.toString()) || [],
        selectedSports: user.selectedSports?.map(id => id.toString()) || [],
      };
    } catch (error) {
      throw new NotFoundException(error.message || 'User not found');
    }
  }


  async ping(): Promise<PingResponse> {
    return { message: 'gRPC service is running' };
  }

  async getUserTeams(userId: string, context: any): Promise<UserTeamsResponse> {
    const user = await this.userService.getUserProfile(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    const teams = await Promise.all(
      user.selectedTeamIds.map(teamId => this.teamService.getTeamById(teamId.toString()))
    ) as TeamDocument[];
    const validTeams = teams.filter(team => team !== null);
    return {
      teams: validTeams.map(team => ({
        id: team.id.toString(),
        name: team.name,
        sportCategoryId: team.sportCategoryId.toString(),
        location: team.location || '',
      })),
    };
  }
  async getAllTeams(): Promise<TeamsList> {
    const teams = await this.teamService.getAllTeams() as TeamDocument[];
    return {
      teams: teams.map(team => ({
        id: team.id.toString(),
        name: team.name,
        sportCategoryId: team.sportCategoryId.toString(),
        location: team.location || ''
      }))
    };
  }

  async createUser(data: CreateUserRequest, context: any): Promise<CreateUserResponse> {
    if (!data.username || !data.email || !data.password) {
      throw new BadRequestException('Username, email, and password are required');
    }
    const result = await this.userService.createUser(
      data.username,
      data.email,
      data.password,
      [],
      data.selectedTeamIds,
      data.notificationPreferences,
    );
    return {
      status: result.status,
      message: result.message,
      user: {
        id: result.mongoUser._id.toString(),
        username: result.mongoUser.username,
        email: result.mongoUser.email,
        role: result.mongoUser.role,
      },
    };
  }

  async upgradeMembership(data: UpgradeMembershipRequest, context: any): Promise<UpgradeMembershipResponse> {
    if (!data.userId || !data.duration) {
      throw new BadRequestException('User ID and duration are required');
    }
    const result = await this.userService.upgradeMembership(
      data.userId,
      { duration: data.duration, price: data.price },
      data.token,
    );
    return {
      status: result.status,
      message: result.message,
      subscriptionPlan: {
        price: result.subscriptionPlan.price,
        duration: result.subscriptionPlan.duration,
        startDate: result.subscriptionPlan.startDate.toISOString(),
        endDate: result.subscriptionPlan.endDate.toISOString(),
        isActive: result.subscriptionPlan.isActive,
      },
    };
  }


  async checkUserExists(userId: string): Promise<boolean> {
    try {
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }
      
      const user = await this.userService.getUserProfile(userId);
      return user !== null;
    } catch (error) {
      // If an error occurs (like user not found), return false
      return false;
    }
  }

  

  async updateUserProfile(data: UpdateUserProfileRequest): Promise<any> {
    if (!data.userId) {
      throw new BadRequestException('User ID is required');
    }

    const updateData: any = {};
    if (data.username) updateData.username = data.username;
    if (data.email) updateData.email = data.email;
    if (data.notificationPreferences) updateData.notificationPreferences = data.notificationPreferences;

    try {
      const updatedUser = await this.userService.updateUserProfile(data.userId, updateData) as UserDocument;
      return {
        status: 'success',
        message: 'User profile updated successfully',
        user: {
          id: updatedUser.id.toString(),
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          membershipStatus: updatedUser.membershipStatus,
          membershipBadge: updatedUser.membershipBadge,
          selectedTeamIds: updatedUser.selectedTeamIds?.map(id => id.toString()) || [],
          selectedSports: updatedUser.selectedSports?.map(id => id.toString()) || [],
        }
      };
    } catch (error) {
      throw new NotFoundException(error.message || 'Failed to update user profile');
    }
  }

  async deleteUser(data: DeleteUserRequest): Promise<StatusResponse> {
    if (!data.userId || !data.authenticatedUserId) {
      throw new BadRequestException('User ID and authenticated user ID are required');
    }

    try {
      await this.userService.deleteUser(data.userId, data.authenticatedUserId, data.isAdmin);
      return {
        status: 'success',
        message: 'User deleted successfully'
      };
    } catch (error) {
      throw new NotFoundException(error.message || 'Failed to delete user');
    }
  }

  async updateSportCategoryPreferences(data: UpdateSportCategoryRequest): Promise<any> {
    if (!data.userId || !data.sportCategoryIds) {
      throw new BadRequestException('User ID and sport category IDs are required');
    }

    try {
      const result = await this.userService.updateSportCategoryPreferences(data.userId, data.sportCategoryIds);
      const user = await this.userService.getUserProfile(data.userId) as UserDocument;
      
      return {
        status: result.status,
        message: result.message,
        user: {
          id: user.id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          membershipStatus: user.membershipStatus,
          membershipBadge: user.membershipBadge,
          selectedTeamIds: user.selectedTeamIds?.map(id => id.toString()) || [],
          selectedSports: user.selectedSports?.map(id => id.toString()) || [],
        }
      };
    } catch (error) {
      throw new NotFoundException(error.message || 'Failed to update sport category preferences');
    }
  }

  async getSportCategoryHierarchy(data: SportCategoryRequest): Promise<SportCategoryHierarchyResponse> {
    if (!data.sportCategoryId) {
      throw new BadRequestException('Sport category ID is required');
    }
  
    try {
      const result = await this.userService.getSportCategoryHierarchy(data.sportCategoryId);
      console.log('Sport category hierarchy result:', JSON.stringify(result, null, 2));
      return result; // Already matches SportCategoryHierarchyResponse
    } catch (error) {
      console.error('Error getting sport category hierarchy:', error);
      throw new NotFoundException(error.message || 'Failed to get sport category hierarchy');
    }
  }
  
  
  

  async linkPaymentToUser(data: LinkPaymentRequest): Promise<StatusResponse> {
    if (!data.userId || !data.paymentId || !data.abonnementId) {
      throw new BadRequestException('User ID, payment ID, and abonnement ID are required');
    }

    try {
      const result = await this.userService.linkPaymentToUser(data.userId, data.paymentId, data.abonnementId);
      return {
        status: result.status,
        message: result.message
      };
    } catch (error) {
      throw new NotFoundException(error.message || 'Failed to link payment to user');
    }
  }

  async assignGestionnaireRole(data: AssignRoleRequest): Promise<StatusResponse> {
    if (!data.userId || !data.teamId) {
      throw new BadRequestException('User ID and team ID are required');
    }

    try {
      const result = await this.userService.assignGestionnaireRole(data.userId, data.teamId);
      return {
        status: result.status,
        message: result.message
      };
    } catch (error) {
      throw new NotFoundException(error.message || 'Failed to assign gestionnaire role');
    }
  }

  async assignAdminRole(data: UserRequest): Promise<StatusResponse> {
    if (!data.userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const result = await this.userService.assignAdminRole(data.userId);
      return {
        status: result.status,
        message: result.message
      };
    } catch (error) {
      throw new NotFoundException(error.message || 'Failed to assign admin role');
    }
  }






}