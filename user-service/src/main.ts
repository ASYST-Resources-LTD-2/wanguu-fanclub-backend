// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'user',
      protoPath: join(process.cwd(), 'src/protos/user.proto'),
      url: '0.0.0.0:50051',
    }
  });
  app.use((req, res, next) => {
    // Log the request to debug
    console.log('Request Headers:', req.headers);
    next();
  });
  await app.startAllMicroservices();
  await app.listen(3000);
  console.log('User Service running on HTTP port 3000 and gRPC port 50051');
}
bootstrap();