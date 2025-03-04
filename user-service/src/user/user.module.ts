// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { Membership, MembershipSchema } from 'src/membership/schemas/membership.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
          clientId: 'user-service',
          brokers: ['localhost:9092'], 
        },
        consumer: {
          groupId: 'user-consumer'
        }
      }
    }
  ])
],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}