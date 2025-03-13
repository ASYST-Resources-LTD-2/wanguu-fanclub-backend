import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Team, TeamSchema } from './schemas/team.schema';
import { TeamService } from './TeamService';
import { TeamController } from './controller/TeamController';
import { SportCategory, SportCategorySchema } from 'src/sportCategory/schemas/sport-category.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';
import { KeycloakModule } from 'src/auth/keycloak/keycloak.module';

@Module({
  imports: [
    MongooseModule.forFeature([
        { name: Team.name, schema: TeamSchema },
        { name: SportCategory.name, schema: SportCategorySchema },
        { name: User.name, schema: UserSchema }
    ]),
    KeycloakModule
  ],
  controllers: [TeamController,],
  providers: [TeamService,],
  exports: [TeamService]
})
export class TeamModule {}
