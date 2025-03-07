import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema';

@Injectable()
export class TeamService {
  constructor(@InjectModel(Team.name) private teamModel: Model<TeamDocument>) {}

  async createTeam(name: string, sportId: string, location?: string): Promise<Team> {
    const newTeam = new this.teamModel({
      name,
      sportId: new Types.ObjectId(sportId),
      location,
    });
    return newTeam.save();
  }

  async getTeamsBySport(sportId: string): Promise<Team[]> {
    return this.teamModel.find({ sportId: new Types.ObjectId(sportId) }).exec();
  }
}