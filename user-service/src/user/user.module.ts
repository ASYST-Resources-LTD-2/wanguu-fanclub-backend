// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { Membership, MembershipSchema } from 'src/membership/schemas/membership.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KeycloakModule } from 'src/keycloak/keycloak.module';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    {name: Membership.name, schema:MembershipSchema}

  ]),
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
        }
      }
    }
  ]),
  KeycloakModule,
],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}