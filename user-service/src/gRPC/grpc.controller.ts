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

@GrpcMethod('UserService', 'CheckUserExists')
async checkUserExists(data: UserRequest): Promise<UserExistsResponse> {
  const exists = await this.grpcService.checkUserExists(data.userId);
  return { exists };
}



  @GrpcMethod('UserService', 'UpdateUserProfile')
  async updateUserProfile(data: UpdateUserProfileRequest): Promise<UserResponse> {
    return this.grpcService.updateUserProfile(data);
  }

  @GrpcMethod('UserService', 'DeleteUser')
  async deleteUser(data: DeleteUserRequest): Promise<StatusResponse> {
    return this.grpcService.deleteUser(data);
  }

  @GrpcMethod('UserService', 'UpdateSportCategoryPreferences')
  async updateSportCategoryPreferences(data: UpdateSportCategoryRequest): Promise<UserResponse> {
    return this.grpcService.updateSportCategoryPreferences(data);
  }

  @GrpcMethod('UserService', 'GetSportCategoryHierarchy')
  @GrpcMethod('UserService', 'GetSportCategoryHierarchy')
async getSportCategoryHierarchy(data: SportCategoryRequest): Promise<SportCategoryHierarchyResponse> {
  return this.grpcService.getSportCategoryHierarchy(data);
  // Remove the JSON.parse as we're now returning the object directly
}


  @GrpcMethod('UserService', 'LinkPaymentToUser')
  async linkPaymentToUser(data: LinkPaymentRequest): Promise<StatusResponse> {
    return this.grpcService.linkPaymentToUser(data);
  }

  @GrpcMethod('UserService', 'AssignGestionnaireRole')
  async assignGestionnaireRole(data: AssignRoleRequest): Promise<StatusResponse> {
    return this.grpcService.assignGestionnaireRole(data);
  }

  @GrpcMethod('UserService', 'AssignAdminRole')
  async assignAdminRole(data: UserRequest): Promise<StatusResponse> {
    return this.grpcService.assignAdminRole(data);
  }

}
