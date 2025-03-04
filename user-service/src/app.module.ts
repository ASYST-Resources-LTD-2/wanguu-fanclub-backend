import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { KeycloakModule } from './keycloak/keycloak.module';
import { User, UserSchema } from './user/schemas/user.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
          options:{
            client: {
              clientId: 'nestjs-kafka',
              brokers: ['localhost:9092'],
            },
          },
        },
      ]),
    UserModule,
    KeycloakModule,
  ],
})
export class AppModule {}