import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { GrpcService } from './grpc.service';

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

@Controller()
export class GrpcController {
  constructor(private readonly grpcService: GrpcService) {}

  @GrpcMethod('UserService', 'GetUserProfile')
  async getUserProfile(data: UserRequest): Promise<UserProfileResponse> {
    return this.grpcService.getUserProfile(data.userId, {});
  }

  @GrpcMethod('UserService', 'GetUserTeams')
  async getUserTeams(data: UserRequest): Promise<UserTeamsResponse> {
    return this.grpcService.getUserTeams(data.userId, {});
  }

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
    return this.grpcService.createUser(data, {});
  }

  @GrpcMethod('UserService', 'UpgradeMembership')
  async upgradeMembership(data: UpgradeMembershipRequest): Promise<UpgradeMembershipResponse> {
    return this.grpcService.upgradeMembership(data, {});
  }
  @GrpcMethod('UserService', 'Ping')
async ping() {
  return { message: 'gRPC service is running' };
}

@GrpcMethod('UserService', 'GetAllUsers')
async getAllUsers(): Promise<GetAllUsersResponse> {
  return this.grpcService.getAllUsers();
}

@GrpcMethod('UserService', 'GetAllTeams')
async getAllTeams(): Promise<TeamsList> {
  return this.grpcService.getAllTeams();
}
}
