import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = {};

    // 🔍 Analyze exception type for proper handling
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        details = exceptionResponse;
      }
    } else if (exception instanceof QueryFailedError) {
      // 🗄️ DATABASE ERRORS - Critical for production
      status = HttpStatus.BAD_REQUEST;

      // Handle specific database errors
      if (exception.message.includes('duplicate key')) {
        message = 'Resource already exists';
        details = { field: 'email', error: 'already_taken' };
      } else if (exception.message.includes('foreign key')) {
        message = 'Invalid reference';
        details = { error: 'invalid_reference' };
      } else if (exception.message.includes('connection')) {
        // 🚨 CRITICAL: Database connection issues
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Service temporarily unavailable';
        details = { error: 'database_unavailable' };

        this.logger.error('🚨 DATABASE CONNECTION FAILURE', {
          error: exception.message,
          request: {
            method: request.method,
            url: request.url,
            ip: request.ip,
            userAgent: request.headers['user-agent']
          }
        });
      } else {
        message = 'Data validation error';
        details = { error: 'database_constraint' };
      }
    } else if (exception instanceof Error) {
      // 🔧 Generic Error handling
      if (exception.message.includes('timeout')) {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Request timeout';
        details = { error: 'timeout' };
      } else if (exception.message.includes('memory')) {
        // 🧠 MEMORY ISSUES - Critical finding from testing
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Service overloaded';
        details = { error: 'memory_pressure' };

        this.logger.error('🧠 MEMORY PRESSURE DETECTED', {
          error: exception.message,
          memoryUsage: process.memoryUsage(),
          activeHandles: (process as any)._getActiveHandles()?.length || 'unknown'
        });
      }
    }

    // 📊 SECURITY LOGGING - Track suspicious activity
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      this.logger.warn('🔐 SECURITY EVENT', {
        status,
        message,
        request: {
          method: request.method,
          url: request.url,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          body: this.sanitizeRequestBody(request.body)
        }
      });
    }

    // 🚨 CRITICAL ERROR ALERTING
    if (status >= 500) {
      this.logger.error('🚨 CRITICAL ERROR', {
        exception: exception instanceof Error ? exception.stack : exception,
        request: {
          method: request.method,
          url: request.url,
          ip: request.ip,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 🔧 GRACEFUL DEGRADATION - Return structured error
    const errorResponse = {
      statusCode: status,
      message,
      ...(Object.keys(details).length > 0 && { details }),
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined
      })
    };

    response.status(status).json(errorResponse);
  }

  // 🧹 Sanitize request body for logging (remove sensitive data)
  private sanitizeRequestBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}