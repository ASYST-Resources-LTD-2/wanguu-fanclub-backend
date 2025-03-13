import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { Logger } from '@nestjs/common';

// const grpcUrl = 'localhost:8085';
const grpcUrl = '0.0.0.0:8085';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  logger.log(`Using gRPC URL: ${grpcUrl}`);

  try {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: 'userService',
        protoPath: join(process.cwd(), 'src/protos/user.proto'),
        url: grpcUrl,
      },
    });

    app.use((req, res, next) => {
      logger.log(`HTTP Request Headers: ${JSON.stringify(req.headers)}`);
      next();
    });

    await app.startAllMicroservices();
    logger.log('gRPC microservice running on port 8085');

    await app.listen(3000);
    logger.log('HTTP server running on port 3000');
  } catch (error) {
    logger.error('Failed to start the application:', error);
    process.exit(1);
  }
}

bootstrap().catch(err => {
  const logger = new Logger('Bootstrap');
  logger.error('Bootstrap failed:', err);
  process.exit(1);
});