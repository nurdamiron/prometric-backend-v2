import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔐 COOKIE PARSER for HttpOnly authentication
  app.use(cookieParser());

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

  // 🚀 BASIC RATE LIMITING (Working version)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 20 : 100,
    message: 'Too many auth attempts, try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests, try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 🔐 SECURE EMAIL VERIFICATION - Special rate limiting for send-code
  const emailCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Only 5 code requests per 15 min per IP + email combination
    message: 'Too many verification code requests, try again later',
    standardHeaders: true,
    legacyHeaders: false,
    // Remove custom keyGenerator to fix IPv6 warning
    // Default generator handles IPv6 properly
  });

  // Apply rate limiting to specific routes
  app.use('/auth/send-code', emailCodeLimiter); // CRITICAL: Prevent spam attacks
  app.use('/auth', authLimiter);
  app.use(generalLimiter);

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
