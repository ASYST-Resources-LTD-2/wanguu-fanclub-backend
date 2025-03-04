import { Controller, Post, Body, Get, Param, UseGuards, Headers, Request } from '@nestjs/common';
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
  @UseGuards(AuthGuard) // Add this to enforce token validation
  @Scopes('profile email')
  @Roles({ roles: ['USER'] })
  async upgradeMembership(
    @Headers('authorization') authorizationHeader: string,
    @Body() body: { userId: string; plan: { price: number; duration: string; startDate: Date; endDate: Date } },
  ) {
    const token = authorizationHeader.split(' ')[1];
    return this.userService.upgradeMembership(body.userId, body.plan, token);
  }

  @Post('assign-gestionnaire')
  @Roles({ roles: ['ADMIN'] })
  async assignGestionnaireRole(@Body() body: { userId: string; teamId: string }) {
    return this.userService.assignGestionnaireRole(body.userId, body.teamId);
  }

 
}