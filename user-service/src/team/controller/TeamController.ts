import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { TeamService } from '../TeamService';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles({ roles: ['ADMIN', 'TEAM_GESTIONNAIRE'] }) // Admins and team managers can create teams
  async createTeam(@Body() body: { name: string; sportId: string; location?: string }) {
    return this.teamService.createTeam(body.name, body.sportId, body.location);
  }

  @Get(':sportId')
  async getTeamsBySport(@Param('sportId') sportId: string) {
    return this.teamService.getTeamsBySport(sportId);
  }
}