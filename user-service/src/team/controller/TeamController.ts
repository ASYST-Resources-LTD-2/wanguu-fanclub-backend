import { Controller, Post, Body, Get, Param, UseGuards, Patch, Delete } from '@nestjs/common';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { TeamService } from '../TeamService';
import { Team } from '../schemas/team.schema';

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
  @Get('detail/:teamId')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['USER', 'ADMIN', 'TEAM_GESTIONNAIRE'] })
  async getTeamById(@Param('teamId') teamId: string) {
    return this.teamService.getTeamById(teamId);
  }

  @Patch(':teamId')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN', 'TEAM_GESTIONNAIRE'] })
  async updateTeam(@Param('teamId') teamId: string, @Body() updateData: Partial<Team>) {
    return this.teamService.updateTeam(teamId, updateData);
  }

  @Delete(':teamId')
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN'] })
  async deleteTeam(@Param('teamId') teamId: string) {
    await this.teamService.deleteTeam(teamId);
    return { status: 'success', message: 'Team deleted successfully' };
  }
}