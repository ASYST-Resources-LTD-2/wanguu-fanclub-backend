import { Controller, Post, Body, Get, Param, UseGuards, Patch, Delete, Req } from '@nestjs/common';
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
async deleteTeam(@Param('teamId') teamId: string, @Req() request: any) {
  const token = request.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new Error('No authorization token provided');
  }

  const decodedToken = this.decodeToken(token);
  const isAdmin = decodedToken.resource_access?.['fanclub-user-membership']?.roles.includes('ADMIN');
  
  if (!isAdmin) {
    throw new Error('Unauthorized: Only admins can delete teams');
  }

  return this.teamService.deleteTeam(teamId);
}



private decodeToken(token: string): any {
  const payload = token.split('.')[1];
  const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(decodedPayload);
}

}