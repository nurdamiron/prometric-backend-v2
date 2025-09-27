// Authorization Module - DDD Clean Architecture
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

// Domain Services
import { AuthorizationDomainService } from './domain/services/authorization-domain.service';

// Application Services
import { AuthorizationService } from './application/authorization.service';

// Command Handlers
import { AssignRoleHandler } from './application/commands/assign-role/assign-role.handler';

// Query Handlers
import { GetUserPermissionsHandler } from './application/queries/get-user-permissions/get-user-permissions.handler';

// Infrastructure - Persistence
import {
  PermissionEntity,
  RoleEntity,
  UserPermissionEntity,
} from './infrastructure/persistence/permission.entity';
import { UserRoleEntity } from './infrastructure/persistence/user-role.entity';

// Infrastructure - Repositories
import { TypeOrmUserRoleRepository } from './infrastructure/repositories/typeorm-user-role.repository';

const CommandHandlers = [AssignRoleHandler];
const QueryHandlers = [GetUserPermissionsHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      UserRoleEntity,
      UserPermissionEntity,
    ]),
  ],
  providers: [
    // Domain Services
    AuthorizationDomainService,

    // Application Services
    AuthorizationService,

    // CQRS Handlers
    ...CommandHandlers,
    ...QueryHandlers,

    // Repository Implementations
    {
      provide: 'UserRoleRepository',
      useClass: TypeOrmUserRoleRepository,
    },
  ],
  exports: [
    AuthorizationService,
    AuthorizationDomainService,
    TypeOrmModule,
  ],
})
export class AuthorizationModule {}