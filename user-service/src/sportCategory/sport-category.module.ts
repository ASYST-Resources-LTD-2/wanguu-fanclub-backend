import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SportCategory, SportCategorySchema } from './schemas/sport-category.schema';
import { SportCategoryService } from './SportCategoryService';
import { SportCategoryController } from './controller/SportCategoryController';
import { KeycloakModule } from 'src/auth/keycloak/keycloak.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SportCategory.name, schema: SportCategorySchema }

    ]),
    KeycloakModule
  ],
  controllers: [SportCategoryController],
  providers: [SportCategoryService],
  exports: [SportCategoryService]
})
export class SportCategoryModule {}
