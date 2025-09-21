import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: process.env.NODE_ENV === 'production',
  }));

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'https://prometric-frontend-v2.onrender.com']
      : ['http://localhost:4000', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3333;
  console.log(`🚀 Prometric Backend starting on port ${port}`);

  await app.listen(port);
}
bootstrap();
