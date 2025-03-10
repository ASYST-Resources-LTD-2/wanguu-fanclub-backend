import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { TeamService } from '../TeamService';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN', 'TEAM_GESTIONNAIRE'] })
  async createTeam(@Body() body: { name: string; sportCategoryId: string; location?: string }) {
    return this.teamService.createTeam(body.name, body.sportCategoryId, body.location);
  }

  @Get(':sportCategoryId')
  @UseGuards(AuthGuard)
  async getTeamsBySportCategory(@Param('sportCategoryId') sportCategoryId: string) {
    return this.teamService.getTeamsBySportCategory(sportCategoryId);
  }
}