import { Controller, Post, Patch, Body, Param, UseGuards, Req, Get, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard, Resource, Roles, Unprotected } from 'nest-keycloak-connect';
import { User, UserDocument } from './schemas/user.schema';

@Controller('users')
@Resource('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @Unprotected()
  async register(
    @Body()
    createUserDto: {
      username: string;
      email: string;
      password: string;
      selectedSports?: string[];
      selectedTeamIds?: string[];
      notificationPreferences?: { email: boolean; sms: boolean };
      teamId?: string;
      role?: string;
      abonnementId?: string;
      paymentId?: string;
    },
  ) {
    return this.userService.createUser(
      createUserDto.username,
      createUserDto.email,
      createUserDto.password,
      createUserDto.selectedSports || [],
      createUserDto.selectedTeamIds || [],
      createUserDto.notificationPreferences || { email: true, sms: false },
      createUserDto.teamId,
      createUserDto.role || 'USER',
      createUserDto.abonnementId,
      createUserDto.paymentId,
    );
  }

  @Post('login')
  @Unprotected()
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.authenticateUser(loginDto.username, loginDto.password);
  }

  @Patch(':userId/teams')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async updateSelectedTeams(
    @Param('userId') userId: string,
    @Body() body: { selectedTeamIds: string[] },
    @Req() request: any,
  ) {
    const selectedTeamIds = body.selectedTeamIds || [];
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');
    const decodedToken = this.decodeToken(token);
    const authenticatedUserId = decodedToken.sub;

    if (
      authenticatedUserId !== userId && 
      !decodedToken.realm_access?.roles.includes('ADMIN') &&
      !decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('USER')
    ) throw new Error('Unauthorized: You can only update your own team selections');

    return this.userService.updateSelectedTeams(userId, selectedTeamIds);
  }

  @Get('profile/:userId')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async getUserProfile(@Param('userId') userId: string, @Req() request: any) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');
    
    const decodedToken = this.decodeToken(token);
    const keycloakUserId = decodedToken.sub;
    
    const authenticatedUser = await this.userService.findUserByKeycloakId(keycloakUserId) as UserDocument;
    if (!authenticatedUser) throw new Error('Authenticated user not found');

    const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
    if (authenticatedUser.id !== userId && !isAdmin) throw new Error('Unauthorized: You can only view your own profile');

    return this.userService.getUserProfile(userId);
  }

  @Patch('profile/:userId')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async updateUserProfile(
    @Param('userId') userId: string,
    @Body() updateData: Partial<User>,
    @Req() request: any,
  ) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');
    const decodedToken = this.decodeToken(token);
    const keycloakUserId = decodedToken.sub;

    const authenticatedUser = await this.userService.findUserByKeycloakId(keycloakUserId) as UserDocument;
    if (!authenticatedUser) throw new Error('Authenticated user not found');

    const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
    if (authenticatedUser.id !== userId && !isAdmin) throw new Error('Unauthorized: You can only update your own profile');

    return this.userService.updateUserProfile(userId, updateData);
  }

  @Delete(':userId')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async deleteUser(@Param('userId') userId: string, @Req() request: any) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');

    const decodedToken = this.decodeToken(token);
    const keycloakUserId = decodedToken.sub;

    const authenticatedUser = await this.userService.findUserByKeycloakId(keycloakUserId) as UserDocument;
    if (!authenticatedUser) throw new Error('Authenticated user not found');

    const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
    
    await this.userService.deleteUser(userId, authenticatedUser.id, isAdmin);
    return { status: 'success', message: 'User deleted successfully' };
  }

  @Get(':username')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async getUser(@Param('username') username: string) {
    return this.userService.findUserByUsername(username);
  }

  @Post('upgrade')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async upgradeMembership(
    @Body() body: { duration: 'Monthly' | 'Yearly'; price?: number },
    @Req() request: any,
  ) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');
    const decodedToken = this.decodeToken(token);
    const userId = decodedToken.sub;
    return this.userService.upgradeMembership(userId, body, token);
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] })
  async getAllUsers(@Req() request: any) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');

    const decodedToken = this.decodeToken(token);
    const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
    
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    return this.userService.getAllUsers();
  }

  @Get(':userId/exists')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async checkUserExists(@Param('userId') userId: string, @Req() request: any): Promise<{ exists: boolean }> {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');
    
    const decodedToken = this.decodeToken(token);
    const authenticatedUserId = decodedToken.sub;

    const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
    if (authenticatedUserId !== userId && !isAdmin) throw new Error('Unauthorized: You can only check your own existence');

    const exists = await this.userService.checkUserExists(userId);
    return { exists };
  }

  @Patch(':userId/sport-categories')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async updateSportCategoryPreferences(
    @Param('userId') userId: string,
    @Body() body: { sportCategoryIds: string[] },
    @Req() request: any,
  ) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');
    const decodedToken = this.decodeToken(token);
    const authenticatedUserId = decodedToken.sub;

    const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
    if (authenticatedUserId !== userId && !isAdmin) throw new Error('Unauthorized: You can only update your own preferences');

    return this.userService.updateSportCategoryPreferences(userId, body.sportCategoryIds);
  }

  @Get('sport-category/:sportCategoryId/hierarchy')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async getSportCategoryHierarchy(@Param('sportCategoryId') sportCategoryId: string) {
    return this.userService.getSportCategoryHierarchy(sportCategoryId);
  }

  @Post(':userId/link-payment')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async linkPaymentToUser(
    @Param('userId') userId: string,
    @Body() body: { paymentId: string; abonnementId: string },
    @Req() request: any,
  ) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No authorization token provided');
    const decodedToken = this.decodeToken(token);
    const authenticatedUserId = decodedToken.sub;

    const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
    if (authenticatedUserId !== userId && !isAdmin) throw new Error('Unauthorized: You can only link payments to your own account');

    return this.userService.linkPaymentToUser(userId, body.paymentId, body.abonnementId);
  }

  @Post('assign-gestionnaire')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] })
  async assignGestionnaireRole(@Body() body: { userId: string; teamId: string }) {
    return this.userService.assignGestionnaireRole(body.userId, body.teamId);
  }

  @Post('assign-admin')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] })
  async assignAdminRole(@Body() body: { userId: string }) {
    return this.userService.assignAdminRole(body.userId);
  }

  private decodeToken(token: string): any {
    const payload = token.split('.')[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decodedPayload);
  }
}