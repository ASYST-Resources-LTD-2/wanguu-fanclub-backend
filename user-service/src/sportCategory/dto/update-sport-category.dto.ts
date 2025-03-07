// src/sport-categories/dto/update-sport-category.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class UpdateSportCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}