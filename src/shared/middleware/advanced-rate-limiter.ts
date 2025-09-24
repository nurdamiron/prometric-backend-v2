import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastRequest: number;
  userId?: string;
}

interface DistributedRateLimit {
  ip: string;
  userId?: string;
  endpoint: string;
  count: number;
  windowStart: number;
  blocked: boolean;
  blockUntil?: number;
}

@Injectable()
export class AdvancedRateLimiterMiddleware implements NestMiddleware {
  private ipLimits = new Map<string, RateLimitEntry>();
  private userLimits = new Map<string, RateLimitEntry>();
  private distributedLimits = new Map<string, DistributedRateLimit>();
  private cleanupInterval: NodeJS.Timeout;

  // 🚀 CONFIGURABLE LIMITS PER ENDPOINT
  private readonly limits: { [key: string]: any } = {
    '/auth/login': {
      ip: { max: 20, window: 15 * 60 * 1000 },      // 20 per 15min per IP
      user: { max: 10, window: 15 * 60 * 1000 },    // 10 per 15min per user
      distributed: { max: 100, window: 60 * 60 * 1000 } // 100 per hour globally
    },
    '/auth/register': {
      ip: { max: 10, window: 60 * 60 * 1000 },      // 10 per hour per IP
      user: { max: 5, window: 60 * 60 * 1000 },     // 5 per hour per user
      distributed: { max: 50, window: 60 * 60 * 1000 } // 50 per hour globally
    },
    '/auth/verify': {
      ip: { max: 30, window: 15 * 60 * 1000 },      // 30 per 15min per IP
      user: { max: 15, window: 15 * 60 * 1000 },    // 15 per 15min per user
      distributed: { max: 200, window: 60 * 60 * 1000 } // 200 per hour globally
    },
    'default': {
      ip: { max: 100, window: 15 * 60 * 1000 },     // 100 per 15min per IP
      user: { max: 200, window: 15 * 60 * 1000 },   // 200 per 15min per user
      distributed: { max: 1000, window: 60 * 60 * 1000 } // 1000 per hour globally
    }
  };

  constructor(private configService: ConfigService) {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Development mode: более generous limits
    if (process.env.NODE_ENV !== 'production') {
      Object.keys(this.limits).forEach(key => {
        if (key !== 'default') {
          this.limits[key].ip.max *= 5;
          this.limits[key].user.max *= 5;
          this.limits[key].distributed.max *= 5;
        }
      });
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const clientIp = this.getClientIP(req);
    const userId = this.extractUserId(req);
    const endpoint = this.normalizeEndpoint(req.path);

    try {
      // 🔍 Multi-layer rate limiting
      const ipCheck = this.checkIPLimit(clientIp, endpoint);
      const userCheck = userId ? this.checkUserLimit(userId, endpoint) : { allowed: true };
      const distributedCheck = this.checkDistributedLimit(clientIp, userId, endpoint);

      // 🚨 Suspicious activity detection
      const suspiciousActivity = this.detectSuspiciousActivity(clientIp, userId, endpoint);

      if (!ipCheck.allowed) {
        this.logSecurityEvent('IP_RATE_LIMIT_EXCEEDED', { ip: clientIp, endpoint });
        throw new HttpException({
          error: 'Rate limit exceeded',
          message: `Too many requests from this IP. Try again in ${Math.ceil((ipCheck.resetIn || 0) / 1000 / 60)} minutes`,
          retryAfter: ipCheck.resetIn
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      if (!userCheck.allowed) {
        this.logSecurityEvent('USER_RATE_LIMIT_EXCEEDED', { userId, endpoint });
        throw new HttpException({
          error: 'User rate limit exceeded',
          message: `Too many requests for this account. Try again later`,
          retryAfter: 900 // 15 minutes
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      if (!distributedCheck.allowed) {
        this.logSecurityEvent('DISTRIBUTED_RATE_LIMIT_EXCEEDED', { ip: clientIp, userId, endpoint });
        throw new HttpException({
          error: 'System rate limit exceeded',
          message: 'System is currently under high load. Please try again later',
          retryAfter: distributedCheck.resetIn
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      if (suspiciousActivity.suspicious) {
        this.logSecurityEvent('SUSPICIOUS_ACTIVITY_DETECTED', {
          ip: clientIp,
          userId,
          endpoint,
          reason: suspiciousActivity.reason
        });

        // Temporary stricter limits for suspicious users
        this.applySuspiciousUserLimits(clientIp, userId);
      }

      // ✅ Request allowed - add headers for client info
      res.setHeader('X-RateLimit-IP-Limit', this.getLimitForEndpoint(endpoint).ip.max);
      res.setHeader('X-RateLimit-IP-Remaining', Math.max(0, this.getLimitForEndpoint(endpoint).ip.max - (ipCheck.count || 0)));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + this.getLimitForEndpoint(endpoint).ip.window).toISOString());

      next();

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Fallback error handling
      console.error('Rate limiter error:', error);
      next(); // Allow request on internal error
    }
  }

  private getClientIP(req: Request): string {
    return (
      req.headers['cf-connecting-ip'] as string ||
      req.headers['x-forwarded-for'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private extractUserId(req: Request): string | undefined {
    // Try to extract user ID from JWT or session
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        // Simple JWT payload extraction (without verification for rate limiting)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          return payload.sub || payload.userId;
        }
      }
    } catch (error) {
      // Ignore extraction errors
    }
    return undefined;
  }

  private normalizeEndpoint(path: string): string {
    // Normalize paths for rate limiting
    for (const endpoint of Object.keys(this.limits)) {
      if (endpoint !== 'default' && path.startsWith(endpoint)) {
        return endpoint;
      }
    }
    return 'default';
  }

  private getLimitForEndpoint(endpoint: string) {
    return this.limits[endpoint] || this.limits['default'];
  }

  private checkIPLimit(ip: string, endpoint: string) {
    const limit = this.getLimitForEndpoint(endpoint).ip;
    const key = `${ip}:${endpoint}`;
    const now = Date.now();

    let entry = this.ipLimits.get(key);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + limit.window,
        lastRequest: now
      };
    }

    entry.count++;
    entry.lastRequest = now;
    this.ipLimits.set(key, entry);

    return {
      allowed: entry.count <= limit.max,
      count: entry.count,
      resetIn: entry.resetTime - now
    };
  }

  private checkUserLimit(userId: string, endpoint: string) {
    const limit = this.getLimitForEndpoint(endpoint).user;
    const key = `${userId}:${endpoint}`;
    const now = Date.now();

    let entry = this.userLimits.get(key);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + limit.window,
        lastRequest: now,
        userId
      };
    }

    entry.count++;
    entry.lastRequest = now;
    this.userLimits.set(key, entry);

    return {
      allowed: entry.count <= limit.max,
      count: entry.count,
      resetIn: entry.resetTime - now
    };
  }

  private checkDistributedLimit(ip: string, userId: string | undefined, endpoint: string) {
    const limit = this.getLimitForEndpoint(endpoint).distributed;
    const key = endpoint;
    const now = Date.now();

    let entry = this.distributedLimits.get(key);
    if (!entry || now > entry.windowStart + limit.window) {
      entry = {
        ip,
        userId,
        endpoint,
        count: 0,
        windowStart: now,
        blocked: false
      };
    }

    entry.count++;
    this.distributedLimits.set(key, entry);

    return {
      allowed: entry.count <= limit.max,
      count: entry.count,
      resetIn: (entry.windowStart + limit.window) - now
    };
  }

  private detectSuspiciousActivity(ip: string, userId: string | undefined, endpoint: string) {
    const ipEntry = this.ipLimits.get(`${ip}:${endpoint}`);
    const userEntry = userId ? this.userLimits.get(`${userId}:${endpoint}`) : null;

    // 🚨 Suspicious patterns
    const reasons = [];

    // Rapid fire requests
    if (ipEntry && ipEntry.lastRequest && Date.now() - ipEntry.lastRequest < 100) {
      reasons.push('rapid_requests');
    }

    // High frequency from single IP
    if (ipEntry && ipEntry.count > this.getLimitForEndpoint(endpoint).ip.max * 0.8) {
      reasons.push('high_ip_frequency');
    }

    // User switching IPs rapidly (if userId available)
    if (userId && userEntry && userEntry.count > this.getLimitForEndpoint(endpoint).user.max * 0.9) {
      reasons.push('high_user_frequency');
    }

    return {
      suspicious: reasons.length > 0,
      reason: reasons.join(', ')
    };
  }

  private applySuspiciousUserLimits(ip: string, userId: string | undefined) {
    // Temporarily reduce limits for suspicious users/IPs
    // This is a simple implementation - in production, you'd use Redis or DB
    console.log(`🚨 Applied suspicious user limits for IP: ${ip}, User: ${userId}`);
  }

  private logSecurityEvent(type: string, details: any) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      details,
      severity: this.getSeverityForEvent(type)
    };

    console.log(`🔒 SECURITY EVENT:`, JSON.stringify(event, null, 2));

    // In production, send to security monitoring system
    // await this.securityMonitoringService.logEvent(event);
  }

  private getSeverityForEvent(type: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'SUSPICIOUS_ACTIVITY_DETECTED': return 'high';
      case 'DISTRIBUTED_RATE_LIMIT_EXCEEDED': return 'medium';
      case 'USER_RATE_LIMIT_EXCEEDED': return 'medium';
      case 'IP_RATE_LIMIT_EXCEEDED': return 'low';
      default: return 'low';
    }
  }

  private cleanup() {
    const now = Date.now();

    // Clean IP limits
    for (const [key, entry] of this.ipLimits.entries()) {
      if (now > entry.resetTime + 60000) { // Keep for 1 minute after reset
        this.ipLimits.delete(key);
      }
    }

    // Clean user limits
    for (const [key, entry] of this.userLimits.entries()) {
      if (now > entry.resetTime + 60000) {
        this.userLimits.delete(key);
      }
    }

    // Clean distributed limits
    for (const [key, entry] of this.distributedLimits.entries()) {
      if (now > entry.windowStart + this.getLimitForEndpoint(entry.endpoint).distributed.window + 60000) {
        this.distributedLimits.delete(key);
      }
    }

    console.log(`🧹 Rate limiter cleanup completed. Active limits: IP=${this.ipLimits.size}, User=${this.userLimits.size}, Distributed=${this.distributedLimits.size}`);
  }

  // Graceful shutdown
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}