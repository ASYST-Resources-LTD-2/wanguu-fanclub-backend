// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((req, res, next) => {
    // Log the request to debug
    console.log('Request Headers:', req.headers);
    next();
  });
  await app.listen(3000);
}
bootstrap();