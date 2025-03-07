import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SportCategory, SportCategoryDocument } from './schemas/sport-category.schema';

@Injectable()
export class SportCategoryService {
  constructor(
    @InjectModel(SportCategory.name) private sportCategoryModel: Model<SportCategoryDocument>,
  ) {}

  // Create a new sport category
  async createSportCategory(
    name: string,
    description: string,
    parentCategoryId?: string,
  ): Promise<SportCategory> {
    try {
      // Check if parent exists (if provided)
      let parentCategory: SportCategoryDocument | null = null;
      if (parentCategoryId) {
        parentCategory = await this.sportCategoryModel.findById(parentCategoryId);
        if (!parentCategory) {
          throw new HttpException(
            `Parent category with ID ${parentCategoryId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
      }

      // Check for duplicate name under the same parent
      const existingCategory = await this.sportCategoryModel.findOne({
        name,
        parentCategoryId: parentCategoryId ? new Types.ObjectId(parentCategoryId) : null,
      });
      if (existingCategory) {
        throw new HttpException(
          `A category with name "${name}" already exists under the same parent`,
          HttpStatus.CONFLICT,
        );
      }

      // Construct the path
      const path = parentCategory ? `${parentCategory.path}/${name}` : name;

      // Create and save the new category
      const newCategory = new this.sportCategoryModel({
        name,
        description,
        parentCategoryId: parentCategoryId ? new Types.ObjectId(parentCategoryId) : null,
        path,
      });
      return await newCategory.save();
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get all sport categories in a hierarchical structure
  async getSportCategories(): Promise<any[]> {
    try {
      return await this.buildCategoryTree(null);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Helper method to build the category tree
  private async buildCategoryTree(parentCategoryId: Types.ObjectId | null): Promise<SportCategory[]> {
    const categories = await this.sportCategoryModel.find({ parentCategoryId }).exec();
    const result: SportCategory[] = [];
    
    for (const category of categories) {
      const subCategories = await this.buildCategoryTree(category._id as Types.ObjectId);
      result.push({
        _id: category._id as Types.ObjectId,
        name: category.name,
        description: category.description,
        path: category.path,
        parentCategoryId: category.parentCategoryId,
        subCategories,
      } as SportCategory);
    }
    return result;
}



  // Update a sport category
  async updateSportCategory(id: string, name?: string, description?: string): Promise<SportCategory> {
    try {
      const category = await this.sportCategoryModel.findById(id);
      if (!category) {
        throw new HttpException(`Category with ID ${id} not found`, HttpStatus.NOT_FOUND);
      }

      if (name && name !== category.name) {
        const oldPath = category.path;
        const newPath = category.path.replace(
          new RegExp(`(^|/)${category.name}(/|$)`),
          `$1${name}$2`,
        );
        category.path = newPath;
        category.name = name;

        // Update subcategories' paths
        await this.updateSubCategoryPaths(oldPath, newPath);
      }

      if (description !== undefined) {
        category.description = description;
      }

      return await category.save();
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Helper method to update subcategory paths
  private async updateSubCategoryPaths(oldPath: string, newPath: string): Promise<void> {
    const subCategories = await this.sportCategoryModel.find({
      path: new RegExp(`^${oldPath}/`),
    });
    for (const subCategory of subCategories) {
      subCategory.path = subCategory.path.replace(new RegExp(`^${oldPath}`), newPath);
      await subCategory.save();
    }
  }

  // Delete a sport category
  async deleteSportCategory(id: string): Promise<void> {
    try {
      const subCategories = await this.sportCategoryModel.find({
        parentCategoryId: new Types.ObjectId(id),
      });
      if (subCategories.length > 0) {
        throw new HttpException(
          'Cannot delete category with subcategories',
          HttpStatus.BAD_REQUEST,
        );
      }
      const deleted = await this.sportCategoryModel.findByIdAndDelete(id);
      if (!deleted) {
        throw new HttpException(`Category with ID ${id} not found`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}