import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() createUserDto: { username: string; email: string; password: string }) {
    return this.userService.createUser(createUserDto.username, createUserDto.email, createUserDto.password);
  }

  @Get(':username')
  async getUser(@Param('username') username: string) {
    return this.userService.findUserByUsername(username);
  }

  @Post('login')
  async login(@Body() loginDto: { username: string; password: string }) {
    return this.userService.authenticateUser(loginDto.username, loginDto.password);
  }
}