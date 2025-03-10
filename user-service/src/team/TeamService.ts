import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema';
import { SportCategory } from 'src/sportCategory/schemas/sport-category.schema';

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    @InjectModel(SportCategory.name) private sportCategoryModel: Model<SportCategory>,
  ) {}

  async createTeam(name: string, sportCategoryId: string, location?: string): Promise<Team & { sportCategory: SportCategory }> {
    const maxRetries = 3;
    let attempt = 0;
    let lastError;
    let result;
  
    while (attempt < maxRetries) {
      try {
        const existingTeam = await this.teamModel.findOne({ name });
        if (existingTeam) {
          throw new HttpException(`Team with name ${name} already exists`, HttpStatus.CONFLICT);
        }
  
        const sportCategory = await this.sportCategoryModel.findById(sportCategoryId);
        if (!sportCategory) {
          throw new HttpException(`Sport category with ID ${sportCategoryId} not found`, HttpStatus.NOT_FOUND);
        }
  
        const newTeam = new this.teamModel({
          name,
          sportCategoryId: new Types.ObjectId(sportCategoryId),
          location,
        });
  
        const savedTeam = await newTeam.save();
        result = { ...savedTeam.toJSON(), sportCategory };
        break;
      } catch (error) {
        lastError = error;
        attempt++;
        if (attempt >= maxRetries) {
          throw new HttpException(
            `Failed to create team after ${maxRetries} attempts: ${lastError.message}`,
            lastError.status || HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
    }
  
    return result;
  }

  async getTeamsBySportCategory(sportCategoryId: string): Promise<Team[]> {
    return this.teamModel.find({ sportCategoryId: new Types.ObjectId(sportCategoryId) }).exec();
  }
}