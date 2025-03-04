import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { KeycloakModule } from './keycloak/keycloak.module';
import { User, UserSchema } from './user/schemas/user.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI 
      || 'mongodb+srv://sogocode:Sogoboss2@clusterfanclub.1y783.mongodb.net/wangu-fan-club-userManagement?retryWrites=true&w=majority'),
      MongooseModule.forFeature([
        {name: User.name,  schema: UserSchema}
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
    UserModule,
    KeycloakModule,
  ],
})
export class AppModule {}