import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SportCategory, SportCategoryDocument } from './schemas/sport-category.schema';

@Injectable()
export class SportCategoryService {
  constructor(@InjectModel(SportCategory.name) private sportCategoryModel: Model<SportCategoryDocument>) {}

  async createSportCategory(name: string, description: string, parentCategoryId?: string): Promise<SportCategory> {
    const newCategory = new this.sportCategoryModel({
      name,
      description,
      parentCategoryId: parentCategoryId ? new Types.ObjectId(parentCategoryId) : null,
    });
    return newCategory.save();
  }

  async getSportCategories(): Promise<SportCategory[]> {
    return this.sportCategoryModel.find().exec();
  }
}