import { Controller, Post, Patch, Body, Param, UseGuards, Req, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard, Resource, Roles, Unprotected } from 'nest-keycloak-connect';

@Controller('users')
@Resource('users') // Define this as a Keycloak resource
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Register a new user (public endpoint)
   */
  @Post('register')
  @Unprotected() // No authentication required for registration
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
    );
  }

  @Post('login')
  @Unprotected()
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.authenticateUser(loginDto.username, loginDto.password);
  }

  /**
   * Update user's selected teams (authenticated users only)
   */
  @Patch(':userId/teams')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async updateSelectedTeams(
    @Param('userId') userId: string,
    @Body() body: { selectedTeamIds: string[] },
    @Req() request: any,
  ) {
    // Ensure selectedTeamIds exists with a default empty array
    const selectedTeamIds = body.selectedTeamIds || [];
    
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new Error('No authorization token provided');
    }
    const decodedToken = this.decodeToken(token);
    const authenticatedUserId = decodedToken.sub;
  
    // Check authorization
    if (
      authenticatedUserId !== userId && 
      !decodedToken.realm_access?.roles.includes('ADMIN') &&
      !decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('USER')
    ) {
      throw new Error('Unauthorized: You can only update your own team selections');
    }
  
    // Pass the validated selectedTeamIds array
    return this.userService.updateSelectedTeams(userId, selectedTeamIds);
  }
  

  /**
   * Get user by username (authenticated users only)
   */
  @Get(':username')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] }) // Users and admins can view profiles
  async getUser(@Param('username') username: string) {
    return this.userService.findUserByUsername(username);
  }

  /**
   * Upgrade membership (authenticated users only)
   */
  @Post('upgrade')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async upgradeMembership(
    @Body() body: { duration: 'Monthly' | 'Yearly'; price?: number },
    @Req() request: any,
  ) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new Error('No authorization token provided');
    }
    const decodedToken = this.decodeToken(token);
    const userId = decodedToken.sub;
    return this.userService.upgradeMembership(userId, body, token);
  }

  /**
   * Assign gestionnaire role (admin only)
   */
  @Post('assign-gestionnaire')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] })
  async assignGestionnaireRole(@Body() body: { userId: string; teamId: string }) {
    return this.userService.assignGestionnaireRole(body.userId, body.teamId);
  }

  /**
   * Assign admin role (admin only)
   */
  @Post('assign-admin')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] })
  async assignAdminRole(@Body() body: { userId: string }) {
    return this.userService.assignAdminRole(body.userId);
  }

  /**
   * Helper method to decode JWT token
   */
  private decodeToken(token: string): any {
    const payload = token.split('.')[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decodedPayload);
  }
}