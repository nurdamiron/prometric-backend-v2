import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip guard for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Skip guard for routes that don't require organization access
    const skipOrgGuard = this.reflector.get<boolean>('skipOrgGuard', context.getHandler());
    if (skipOrgGuard) {
      return true;
    }

    // Extract organization ID from various sources
    const orgId = this.extractOrganizationId(request);

    // For owners and admins, ensure they can only access their own organization
    if (user.role === 'owner' || user.role === 'admin') {
      if (!user.organizationId) {
        throw new ForbiddenException('User not associated with any organization');
      }

      if (orgId && orgId !== user.organizationId) {
        throw new ForbiddenException('Access denied to this organization');
      }

      // If no orgId in request, inject user's organizationId for data filtering
      if (!orgId) {
        this.injectOrganizationId(request, user.organizationId);
      }
    }

    // For employees, they must have organization access and be approved
    if (user.role === 'employee') {
      if (!user.organizationId) {
        throw new ForbiddenException('Employee not assigned to organization');
      }

      if (orgId && orgId !== user.organizationId) {
        throw new ForbiddenException('Access denied to this organization');
      }

      // Inject organizationId for data filtering
      if (!orgId) {
        this.injectOrganizationId(request, user.organizationId);
      }
    }

    return true;
  }

  private extractOrganizationId(request: any): string | null {
    // Check various sources for organization ID
    return (
      request.params?.organizationId ||
      request.params?.orgId ||
      request.query?.organizationId ||
      request.query?.orgId ||
      request.body?.organizationId ||
      request.body?.orgId ||
      null
    );
  }

  private injectOrganizationId(request: any, organizationId: string): void {
    // Inject organizationId into request for downstream filters
    request.organizationId = organizationId;

    // Also inject into query params for ORM filters
    if (!request.query) {
      request.query = {};
    }
    request.query.organizationId = organizationId;

    // Inject into body for POST/PUT requests
    if (request.body && typeof request.body === 'object') {
      request.body.organizationId = organizationId;
    }
  }
}

// Decorator to skip organization guard
export const SkipOrgGuard = () => {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    const key = propertyKey || 'class';
    Reflect.defineMetadata('skipOrgGuard', true, target, key);
  };
};