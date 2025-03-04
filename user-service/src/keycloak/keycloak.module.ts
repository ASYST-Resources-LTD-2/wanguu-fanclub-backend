// src/keycloak/keycloak.module.ts
import { Module } from '@nestjs/common';
import { KeycloakConnectModule, AuthGuard, ResourceGuard, RoleGuard } from 'nest-keycloak-connect';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    KeycloakConnectModule.register({
      authServerUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      realm: process.env.KEYCLOAK_REALM || 'FanClubRealm',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'fanclub-user-membership',
      secret: process.env.KEYCLOAK_CLIENT_SECRET || 'vRLWCtcmwivtUJKGNgECqNrhoy2jCLfT',
      cookieKey: 'User JWT',
      logLevels: ['warn', 'error'],
      useNestLogger: true,
    }),
  ],
  providers: [
    // Keep the guards as global
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
  exports: [KeycloakConnectModule], // Export the module
})
//   providers: [
//     {
//       provide: APP_GUARD,
//       useClass: AuthGuard, // Ensure token validation happens first
//     },
//     {
//       provide: APP_GUARD,
//       useClass: ResourceGuard, // Handle resource-level authorization
//     },
//     {
//       provide: APP_GUARD,
//       useClass: RoleGuard, // Handle role-based authorization
//     },
//   ],
// })
export class KeycloakModule {}