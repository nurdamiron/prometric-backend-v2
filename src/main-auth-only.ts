import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { AuthOnlyModule } from './auth-only.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AuthOnlyModule);

  // 🚀 PERFORMANCE: Compression middleware for response optimization
  app.use(compression({
    level: 6, // Good balance between compression and CPU usage
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      // Skip compression for certain content types
      const contentType = res.getHeader('Content-Type');
      if (typeof contentType === 'string' && contentType.includes('image/')) return false;
      return compression.filter(req, res);
    }
  }));

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Rate Limiting - Optimized for production use
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 20 : 100, // 20 prod, 100 dev
    message: 'Too many login attempts, try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    skip: (req) => {
      // Skip rate limiting for test endpoints in development
      if (process.env.NODE_ENV !== 'production' && req.ip === '127.0.0.1') {
        return true;
      }
      return false;
    }
  });

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 10 : 50, // 10 prod, 50 dev
    message: 'Too many registration attempts, try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful registrations
    skip: (req) => {
      // Skip rate limiting for localhost in development
      if (process.env.NODE_ENV !== 'production' && req.ip === '127.0.0.1') {
        return true;
      }
      return false;
    }
  });

  // Apply rate limits to specific routes
  app.use('/auth/login', authLimiter);
  app.use('/auth/register', registerLimiter);

  // 🔧 GLOBAL ERROR HANDLING & GRACEFUL DEGRADATION
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enhanced global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: false
    },
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

  const port = process.env.PORT || 3334; // Different port to avoid conflicts
  console.log(`🚀 Prometric Auth-Only Backend starting on port ${port}`);

  await app.listen(port);
}
bootstrap();