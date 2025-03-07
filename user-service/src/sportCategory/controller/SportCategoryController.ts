import { Controller, Post, Body, Get, UseGuards,  } from '@nestjs/common';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { SportCategoryService } from '../SportCategoryService';

@Controller('sport-categories')
export class SportCategoryController {
  constructor(private readonly sportCategoryService: SportCategoryService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] }) // Only admins can create categories
  async createSportCategory(
    @Body() body: { name: string; description: string; parentCategoryId?: string },
  ) {
    return this.sportCategoryService.createSportCategory(body.name, body.description, body.parentCategoryId);
  }

  @Get()
  async getSportCategories() {
    return this.sportCategoryService.getSportCategories();
  }
}