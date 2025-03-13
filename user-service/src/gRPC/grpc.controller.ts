import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { GrpcService } from './grpc.service';
import { AuthInterceptor } from 'src/auth/auth.interceptor';

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

@Controller()
@UseInterceptors(AuthInterceptor) // Apply Keycloak authentication for all gRPC methods
export class GrpcController {
  constructor(private readonly grpcService: GrpcService) {}

  @GrpcMethod('UserService', 'GetUserProfile')
  async getUserProfile(data: UserRequest, metadata: Metadata, call: any): Promise<UserProfileResponse> {
    const authenticatedUser = call.getContext()['user'];
    if (!authenticatedUser || authenticatedUser.sub !== data.userId) {
      throw new Error('Unauthorized: You can only access your own profile');
    }
    return this.grpcService.getUserProfile(data.userId, call.getContext());
  }

  @GrpcMethod('UserService', 'GetUserTeams')
  async getUserTeams(data: UserRequest, metadata: Metadata, call: any): Promise<UserTeamsResponse> {
    const authenticatedUser = call.getContext()['user'];
    if (!authenticatedUser || authenticatedUser.sub !== data.userId) {
      throw new Error('Unauthorized: You can only access your own teams');
    }
    return this.grpcService.getUserTeams(data.userId, call.getContext());
  }

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: CreateUserRequest, metadata: Metadata, call: any): Promise<CreateUserResponse> {
    // No authentication check for createUser since it's typically a public or admin operation
    return this.grpcService.createUser(data, call.getContext());
  }

  @GrpcMethod('UserService', 'UpgradeMembership')
  async upgradeMembership(data: UpgradeMembershipRequest, metadata: Metadata, call: any): Promise<UpgradeMembershipResponse> {
    const authenticatedUser = call.getContext()['user'];
    if (!authenticatedUser || authenticatedUser.sub !== data.userId) {
      throw new Error('Unauthorized: You can only upgrade your own membership');
    }
    return this.grpcService.upgradeMembership(data, call.getContext());
  }
}