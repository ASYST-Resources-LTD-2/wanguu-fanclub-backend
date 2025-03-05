import { Controller, Post, Body, Get, Param, UseGuards, Headers, Request, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { Resource, RoleGuard, Roles, Unprotected, AuthGuard, Scopes} from 'nest-keycloak-connect';
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';

@Controller('users')
@Resource('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @Unprotected()
  async register(@Body() createUserDto: { username: string; email: string; password: string }) {
    return this.userService.createUser(createUserDto.username, createUserDto.email, createUserDto.password);
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
  @Roles({ roles: ['USER'] })
  async upgradeMembership(
    @Body() body: {
      plan: { price: number; duration: string; startDate: Date; endDate: Date };
    },
    @Req() request: any,
  ) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new Error('No authorization token provided');
    }

    // Decode the token to get the sub (Keycloak user ID)
    const decodedToken = this.decodeToken(token);
    const userId = decodedToken.sub; // This is "17621c00-d704-4b91-aea1-9c3be825d266"

    return this.userService.upgradeMembership(userId, body.plan, token);
  }

  private decodeToken(token: string): any {
    // Decode the JWT payload (base64 decoding)
    const payload = token.split('.')[1];
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decodedPayload);
  }

  @Post('assign-gestionnaire')
  @Roles({ roles: ['ADMIN'] })
  async assignGestionnaireRole(@Body() body: { userId: string; teamId: string }) {
    return this.userService.assignGestionnaireRole(body.userId, body.teamId);
  }

 
}