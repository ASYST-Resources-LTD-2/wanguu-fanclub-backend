import { Controller, Post, Body, Get, Param, UseGuards, Headers, Request, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { Resource, RoleGuard, Roles, Unprotected, AuthGuard, Scopes } from 'nest-keycloak-connect';

@Controller('users')
@Resource('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @Unprotected()
  async register(
    @Body() createUserDto: { 
      username: string; 
      email: string; 
      password: string; 
      role?: string 
    }
  ) {
    return this.userService.createUser(
      createUserDto.username, 
      createUserDto.email, 
      createUserDto.password,
      [],  // selectedSports (optional)
      [],  // selectedTeamIds (optional)
      { email: true, sms: false }, // notificationPreferences default
      undefined, // teamId (optional)
      createUserDto.role || 'USER'
    );
  }

  @Post('login')
  @Unprotected()
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.authenticateUser(loginDto.username, loginDto.password);
  }

  @Get(':username')
  async getUser(@Param('username') username: string) {
    return this.userService.findUserByUsername(username);
  }

  @Post('upgrade')
  @UseGuards(AuthGuard)
  @Resource('users')
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

  private decodeToken(token: string): any {
    const payload = token.split('.')[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decodedPayload);
  }

  @Post('assign-gestionnaire')
  @UseGuards(AuthGuard)
  @Resource('users')
  @Roles({ roles: ['ADMIN'] })
  async assignGestionnaireRole(@Body() body: { userId: string; teamId: string }) {
    return this.userService.assignGestionnaireRole(body.userId, body.teamId);
  }
  @Post('assign-admin')
  @UseGuards(AuthGuard)
  @Resource('users')
  @Roles({ roles: ['ADMIN'] })
async assignAdminRole(@Body() body: { userId: string }) {
  return this.userService.assignAdminRole(body.userId);
}
}