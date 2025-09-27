// Authorization Domain - Permission and Role Management

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: PermissionAction;
  conditions?: PermissionCondition[];
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage'
}

export interface PermissionCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
  description?: string;
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  IN = 'in',
  NOT_IN = 'not_in',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IS_OWNER = 'is_owner',
  SAME_ORGANIZATION = 'same_organization'
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  organizationId?: string; // Organization-specific roles
  isSystemRole: boolean;
  level: RoleLevel;
  createdAt: Date;
  updatedAt: Date;
}

export enum RoleLevel {
  SYSTEM = 0,      // System admin
  ORGANIZATION = 1, // Organization owner
  DEPARTMENT = 2,   // Department manager
  TEAM = 3,        // Team lead
  USER = 4         // Regular user
}

export interface UserPermissions {
  userId: string;
  organizationId: string;
  roles: Role[];
  directPermissions: Permission[];
  computedPermissions: Permission[];
  lastUpdated: Date;
}

// Default system permissions for Prometric CRM
export const SYSTEM_PERMISSIONS = {
  // User management
  USER_CREATE: {
    name: 'user:create',
    resource: 'user',
    action: PermissionAction.CREATE,
    description: 'Create new users'
  },
  USER_READ: {
    name: 'user:read',
    resource: 'user',
    action: PermissionAction.READ,
    description: 'View user information'
  },
  USER_UPDATE: {
    name: 'user:update',
    resource: 'user',
    action: PermissionAction.UPDATE,
    description: 'Update user information'
  },
  USER_DELETE: {
    name: 'user:delete',
    resource: 'user',
    action: PermissionAction.DELETE,
    description: 'Delete users'
  },

  // Customer management
  CUSTOMER_CREATE: {
    name: 'customer:create',
    resource: 'customer',
    action: PermissionAction.CREATE,
    description: 'Create new customers'
  },
  CUSTOMER_READ: {
    name: 'customer:read',
    resource: 'customer',
    action: PermissionAction.READ,
    description: 'View customer information'
  },
  CUSTOMER_UPDATE: {
    name: 'customer:update',
    resource: 'customer',
    action: PermissionAction.UPDATE,
    description: 'Update customer information'
  },
  CUSTOMER_DELETE: {
    name: 'customer:delete',
    resource: 'customer',
    action: PermissionAction.DELETE,
    description: 'Delete customers'
  },

  // Sales pipeline
  DEAL_CREATE: {
    name: 'deal:create',
    resource: 'deal',
    action: PermissionAction.CREATE,
    description: 'Create new deals'
  },
  DEAL_READ: {
    name: 'deal:read',
    resource: 'deal',
    action: PermissionAction.READ,
    description: 'View deals'
  },
  DEAL_UPDATE: {
    name: 'deal:update',
    resource: 'deal',
    action: PermissionAction.UPDATE,
    description: 'Update deals'
  },
  DEAL_DELETE: {
    name: 'deal:delete',
    resource: 'deal',
    action: PermissionAction.DELETE,
    description: 'Delete deals'
  },

  // AI Brain permissions
  AI_CONFIGURE: {
    name: 'ai:configure',
    resource: 'ai',
    action: PermissionAction.MANAGE,
    description: 'Configure AI assistant and brain'
  },
  AI_CHAT: {
    name: 'ai:chat',
    resource: 'ai',
    action: PermissionAction.EXECUTE,
    description: 'Chat with AI assistant'
  },
  AI_KNOWLEDGE_MANAGE: {
    name: 'ai:knowledge:manage',
    resource: 'ai-knowledge',
    action: PermissionAction.MANAGE,
    description: 'Manage AI knowledge base'
  },

  // Analytics and reporting
  ANALYTICS_READ: {
    name: 'analytics:read',
    resource: 'analytics',
    action: PermissionAction.READ,
    description: 'View analytics and reports'
  },
  ANALYTICS_MANAGE: {
    name: 'analytics:manage',
    resource: 'analytics',
    action: PermissionAction.MANAGE,
    description: 'Manage analytics settings'
  },

  // Organization management
  ORGANIZATION_MANAGE: {
    name: 'organization:manage',
    resource: 'organization',
    action: PermissionAction.MANAGE,
    description: 'Manage organization settings'
  }
};

// Default roles for Prometric CRM
export const SYSTEM_ROLES = {
  OWNER: {
    name: 'owner',
    displayName: 'Owner',
    description: 'Organization owner with full access',
    level: RoleLevel.ORGANIZATION,
    permissions: Object.values(SYSTEM_PERMISSIONS)
  },
  ADMIN: {
    name: 'admin',
    displayName: 'Administrator',
    description: 'System administrator',
    level: RoleLevel.DEPARTMENT,
    permissions: [
      SYSTEM_PERMISSIONS.USER_CREATE,
      SYSTEM_PERMISSIONS.USER_READ,
      SYSTEM_PERMISSIONS.USER_UPDATE,
      SYSTEM_PERMISSIONS.CUSTOMER_CREATE,
      SYSTEM_PERMISSIONS.CUSTOMER_READ,
      SYSTEM_PERMISSIONS.CUSTOMER_UPDATE,
      SYSTEM_PERMISSIONS.DEAL_CREATE,
      SYSTEM_PERMISSIONS.DEAL_READ,
      SYSTEM_PERMISSIONS.DEAL_UPDATE,
      SYSTEM_PERMISSIONS.AI_CONFIGURE,
      SYSTEM_PERMISSIONS.AI_CHAT,
      SYSTEM_PERMISSIONS.ANALYTICS_READ
    ]
  },
  MANAGER: {
    name: 'manager',
    displayName: 'Manager',
    description: 'Team manager',
    level: RoleLevel.TEAM,
    permissions: [
      SYSTEM_PERMISSIONS.CUSTOMER_CREATE,
      SYSTEM_PERMISSIONS.CUSTOMER_READ,
      SYSTEM_PERMISSIONS.CUSTOMER_UPDATE,
      SYSTEM_PERMISSIONS.DEAL_CREATE,
      SYSTEM_PERMISSIONS.DEAL_READ,
      SYSTEM_PERMISSIONS.DEAL_UPDATE,
      SYSTEM_PERMISSIONS.AI_CHAT,
      SYSTEM_PERMISSIONS.ANALYTICS_READ
    ]
  },
  EMPLOYEE: {
    name: 'employee',
    displayName: 'Employee',
    description: 'Regular employee',
    level: RoleLevel.USER,
    permissions: [
      SYSTEM_PERMISSIONS.CUSTOMER_READ,
      SYSTEM_PERMISSIONS.CUSTOMER_UPDATE,
      SYSTEM_PERMISSIONS.DEAL_READ,
      SYSTEM_PERMISSIONS.DEAL_UPDATE,
      SYSTEM_PERMISSIONS.AI_CHAT
    ]
  }
};

// Domain Events
export class PermissionGrantedEvent {
  constructor(
    public readonly userId: string,
    public readonly permission: Permission,
    public readonly grantedBy: string,
    public readonly organizationId: string
  ) {}
}

export class PermissionRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly permission: Permission,
    public readonly revokedBy: string,
    public readonly organizationId: string
  ) {}
}

export class RoleAssignedEvent {
  constructor(
    public readonly userId: string,
    public readonly role: Role,
    public readonly assignedBy: string,
    public readonly organizationId: string
  ) {}
}

export class RoleRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly role: Role,
    public readonly revokedBy: string,
    public readonly organizationId: string
  ) {}
}