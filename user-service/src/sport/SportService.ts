import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sport, SportDocument } from './schemas/sport.schema';

@Injectable()
export class SportService {
  constructor(@InjectModel(Sport.name) private sportModel: Model<SportDocument>) {}

  async createSport(name: string, categoryId: string): Promise<Sport> {
    const newSport = new this.sportModel({
      name,
      categoryId: new Types.ObjectId(categoryId),
    });
    return newSport.save();
  }

  async getSportsByCategory(categoryId: string): Promise<Sport[]> {
    return this.sportModel.find({ categoryId: new Types.ObjectId(categoryId) }).exec();
  }
}