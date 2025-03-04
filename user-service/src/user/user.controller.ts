import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { Resource, Roles, Unprotected } from 'nest-keycloak-connect';

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
  @Roles({ roles: ['USER'] })
  async upgradeMembership(
    @Body() body: { userId: string; plan: { price: number; duration: string; startDate: Date; endDate: Date } },
  ) {
    return this.userService.upgradeMembership(body.userId, body.plan);
  }

  @Post('assign-gestionnaire')
  @Roles({ roles: ['ADMIN'] })
  async assignGestionnaireRole(@Body() body: { userId: string; teamId: string }) {
    return this.userService.assignGestionnaireRole(body.userId, body.teamId);
  }

 
}