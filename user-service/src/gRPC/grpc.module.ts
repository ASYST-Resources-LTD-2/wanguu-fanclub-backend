import { Module } from '@nestjs/common';
import { GrpcController } from './grpc.controller';
import { GrpcService } from './grpc.service';
import { UserModule } from '../user/user.module';
import { TeamModule } from '../team/team.module';
import { SportCategoryModule } from '../sportCategory/sport-category.module';
import { KeycloakConnectModule } from 'nest-keycloak-connect';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthInterceptor } from 'src/auth/auth.interceptor';
import { KeycloakModule } from 'src/auth/keycloak/keycloak.module';

@Module({
  imports: [
    UserModule,
    TeamModule,
    SportCategoryModule,
    KeycloakModule,
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [GrpcController],
  providers: [
    GrpcService,
    // AuthInterceptor,
    // {
    //   provide: 'KeycloakInstance',
    //   useFactory: (configService: ConfigService) => {
    //     const Keycloak = require('keycloak-connect');
    //     return new Keycloak({}, {
    //       realm: configService.get('KEYCLOAK_REALM') || 'FanClubRealm',
    //       'auth-server-url': configService.get('KEYCLOAK_URL') || 'http://localhost:8080',
    //       'ssl-required': 'external',
    //       resource: configService.get('KEYCLOAK_CLIENT_ID') || 'fanclub-user-membership',
    //       credentials: {
    //         secret: configService.get('KEYCLOAK_CLIENT_SECRET') || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT'
    //       },
    //       'confidential-port': 0
    //     });
    //   },
    //   inject: [ConfigService]
    // }
  ],
  // exports: [KeycloakConnectModule, KeycloakModule]
})
export class GrpcModule {}
