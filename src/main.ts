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

  // 🔐 ENHANCED RATE LIMITING for Critical Security

  // Login attempts - Very strict
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 5 : 50, // 5 attempts in production
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count ALL attempts
  });

  // Registration - Moderate
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 3 : 30, // 3 registrations per hour
    message: 'Too many registration attempts from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Email verification codes - Very strict
  const emailCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 3 : 100, // 3 in production, 100 in development
    message: 'Too many verification code requests. Please wait before trying again',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Password reset - Strict
  const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 3 : 20, // 3 attempts in production
    message: 'Too many password reset attempts',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // General auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 30 : 100,
    message: 'Too many auth attempts, try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // General API requests
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests, try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to specific critical routes
  app.use('/auth/login', loginLimiter);         // CRITICAL: Prevent brute force
  app.use('/auth/register', registerLimiter);   // CRITICAL: Prevent spam accounts
  app.use('/auth/send-code', emailCodeLimiter); // CRITICAL: Prevent email spam
  app.use('/auth/verify-code', emailCodeLimiter); // CRITICAL: Prevent code guessing
  app.use('/auth/reset-password', passwordResetLimiter); // CRITICAL: Prevent abuse
  app.use('/auth/forgot-password', passwordResetLimiter); // CRITICAL: Prevent abuse
  app.use('/auth', authLimiter);  // Other auth endpoints
  app.use(generalLimiter);        // All other endpoints

  // 🔧 GLOBAL ERROR HANDLING & GRACEFUL DEGRADATION
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enhanced global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false, // Allow organizationId injection from OrganizationGuard
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
