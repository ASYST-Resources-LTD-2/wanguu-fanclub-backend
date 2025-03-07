// src/sport-categories/dto/create-sport-category.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSportCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  parentCategoryId?: string;
}