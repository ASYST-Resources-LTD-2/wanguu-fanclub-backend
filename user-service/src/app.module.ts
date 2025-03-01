import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { KeycloakModule } from './keycloak/keycloak.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb+srv://sogocode:Sogoboss2@clusterfanclub.1y783.mongodb.net/wangu-fan-club-userManagement?retryWrites=true&w=majority'),
    UserModule,
  ],
})
export class AppModule {}