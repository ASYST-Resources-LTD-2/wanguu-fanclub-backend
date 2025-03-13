import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class GrpcService {
  constructor(
    private readonly userService: UserService,
    private readonly teamService: TeamService,
    private readonly sportCategoryService: SportCategoryService,
  ) {}

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
}