import { Controller, Post, Body, Get, Param, UseGuards,  } from '@nestjs/common';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { SportService } from '../SportService';

@Controller('sports')
export class SportController {
  constructor(private readonly sportService: SportService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] }) // Only admins can create sports
  async createSport(@Body() body: { name: string; categoryId: string }) {
    return this.sportService.createSport(body.name, body.categoryId);
  }

  @Get(':categoryId')
  async getSportsByCategory(@Param('categoryId') categoryId: string) {
    return this.sportService.getSportsByCategory(categoryId);
  }
}