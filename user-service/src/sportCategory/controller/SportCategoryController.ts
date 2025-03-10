import { Controller, Post, Body, Get, Patch, Param, Delete, HttpCode, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { SportCategoryService } from '../SportCategoryService';
import { CreateSportCategoryDto } from '../dto/create-sport-category.dto';
import { UpdateSportCategoryDto } from '../dto/update-sport-category.dto';

@Controller('sport-categories')
export class SportCategoryController {
  constructor(private readonly sportCategoryService: SportCategoryService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] }) // Only admins can create categories
  async create(@Body() createSportCategoryDto: CreateSportCategoryDto) {
    const { name, description, parentCategoryId } = createSportCategoryDto;
    return this.sportCategoryService.createSportCategory(name, description || '', parentCategoryId);
  }

  @Get()
  @UseGuards(AuthGuard) // Require authentication for retrieving categories
  async findAll() {
    return this.sportCategoryService.getSportCategories();
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] }) // Only admins can update categories
  async update(
    @Param('id') id: string,
    @Body() updateSportCategoryDto: UpdateSportCategoryDto,
  ) {
    const { name, description } = updateSportCategoryDto;
    return this.sportCategoryService.updateSportCategory(id, name, description);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] }) // Only admins can delete categories
  async remove(@Param('id') id: string) {
    await this.sportCategoryService.deleteSportCategory(id);
    return null;
  }


  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN'] })
  async getSportCategoryById(@Param('id') id: string) {
    return this.sportCategoryService.getSportCategoryById(id);
  }
}