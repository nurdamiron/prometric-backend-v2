import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { AdvancedRateLimiterMiddleware } from './shared/middleware/advanced-rate-limiter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // 🚀 ADVANCED DISTRIBUTED RATE LIMITING
  // Multi-layer protection: IP + User + Distributed + Suspicious activity detection
  const advancedRateLimiter = new AdvancedRateLimiterMiddleware(app.get('ConfigService'));

  // Apply advanced rate limiting to all routes
  app.use(advancedRateLimiter.use.bind(advancedRateLimiter));

  // Legacy rate limiting as fallback (more lenient)
  const fallbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 200 : 1000, // Generous fallback limits
    message: 'System temporarily unavailable',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip for localhost in development
      if (process.env.NODE_ENV !== 'production' && req.ip === '127.0.0.1') {
        return true;
      }
      return false;
    }
  });

  app.use(fallbackLimiter);

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

  const port = process.env.PORT || 3333;
  console.log(`🚀 Prometric Backend starting on port ${port}`);

  await app.listen(port);
}
bootstrap();
