import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { KeycloakModule } from './auth/keycloak/keycloak.module';
import { User, UserSchema } from './user/schemas/user.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SportCategory, SportCategorySchema } from './sportCategory/schemas/sport-category.schema';
import { Team, TeamSchema } from './team/schemas/team.schema';
import { SportCategoryController } from './sportCategory/controller/SportCategoryController';
import { TeamController } from './team/controller/TeamController';
import { SportCategoryService } from './sportCategory/SportCategoryService';
import { TeamService } from './team/TeamService';
// import { GrpcModule } from './gRPC/grpc.module';
import { SportCategoryModule } from './sportCategory/sport-category.module';
import { TeamModule } from './team/team.module';
import { GrpcController } from './gRPC/grpc.controller';
import { GrpcService } from './gRPC/grpc.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KeycloakConnectModule } from 'nest-keycloak-connect';
import { GrpcModule } from './gRPC/grpc.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI 
      || 'mongodb+srv://sogocode:Sogoboss2@clusterfanclub.1y783.mongodb.net/wangu-fan-club-userManagement?retryWrites=true&w=majority'),
    MongooseModule.forFeature([
      {name: User.name, schema: UserSchema},
      {name: SportCategory.name, schema: SportCategorySchema},
      {name: Team.name, schema: TeamSchema},
    ]),
    KeycloakConnectModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        authServerUrl: configService.get('KEYCLOAK_URL') || 'http://localhost:8080',
        realm: configService.get('KEYCLOAK_REALM') || 'FanClubRealm',
        clientId: configService.get('KEYCLOAK_CLIENT_ID') || 'fanclub-user-membership',
        secret: configService.get('KEYCLOAK_CLIENT_SECRET') || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
        cookieKey: 'User JWT',
        logLevels: ['warn', 'error'],
        useNestLogger: true,
      }),
      inject: [ConfigService],
    }),
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'user-service-client',
            brokers: ['localhost:9092'],
            connectionTimeout: 5000,
            retry: {
              initialRetryTime: 300,
              retries: 10,
              maxRetryTime: 30000
            }
          },
          consumer: {
            groupId: 'user-consumer',
            sessionTimeout: 45000,
            heartbeatInterval: 15000,
            rebalanceTimeout: 60000,
            allowAutoTopicCreation: true
          },
          producer: {
            allowAutoTopicCreation: true,
            idempotent: true
          },
        },
      },
    ]),
    UserModule,
    KeycloakModule,
    GrpcModule,
    SportCategoryModule,
    TeamModule,
  ],
  controllers: [SportCategoryController, TeamController, GrpcController],
  providers: [
    SportCategoryService,
    TeamService, 
    GrpcService,
    {
      provide: 'KeycloakInstance',
      useFactory: (configService: ConfigService) => {
        const Keycloak = require('keycloak-connect');
        return new Keycloak({}, {
          realm: configService.get('KEYCLOAK_REALM') || 'FanClubRealm',
          'auth-server-url': configService.get('KEYCLOAK_URL') || 'http://localhost:8080',
          'ssl-required': 'external',
          resource: configService.get('KEYCLOAK_CLIENT_ID') || 'fanclub-user-membership',
          credentials: {
            secret: configService.get('KEYCLOAK_CLIENT_SECRET') || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT'
          },
          'confidential-port': 0
        });
      },
      inject: [ConfigService]
    }
  ],
})
export class AppModule {}
