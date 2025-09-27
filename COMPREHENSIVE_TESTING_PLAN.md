# 🧪 КОМПЛЕКСНЫЙ ПЛАН ТЕСТИРОВАНИЯ PROMETRIC V2

## 📋 EXECUTIVE SUMMARY

**Цель**: Обеспечить 100% готовность системы к production через максимально глубокое тестирование всех компонентов.

**Scope**:
- Backend DDD Architecture (5 Bounded Contexts)
- Frontend Integration (Next.js 15)
- Database Layer (PostgreSQL + pgvector)
- Security Layer (HttpOnly cookies + RBAC)
- Department Data Isolation
- AI Services Integration

**Timeline**: 5-7 дней интенсивного тестирования

---

## 🛡️ PHASE 1: SECURITY TESTING (КРИТИЧЕСКИЙ ПРИОРИТЕТ)

### **1.1 Authentication & Authorization Testing**

#### **HttpOnly Cookies Security Tests**
```bash
# Test Case 1: Cookie Security Attributes
curl -v -X POST http://localhost:3333/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@prometric.kz","password":"TestPass123!"}'

# Verify:
# ✅ Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=strict
# ✅ Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=strict

# Test Case 2: Token Refresh Mechanism
curl -v -X POST http://localhost:3333/api/v1/auth/refresh \
  --cookie "refresh_token=VALID_REFRESH_TOKEN"

# Verify:
# ✅ New access_token generated
# ✅ Old access_token invalidated
# ✅ Refresh token rotation

# Test Case 3: Auto-logout on Expired Tokens
curl -v -X GET http://localhost:3333/api/v1/customers \
  --cookie "access_token=EXPIRED_TOKEN"

# Verify:
# ✅ 401 Unauthorized
# ✅ Clear cookie headers sent
```

#### **RBAC Permission Tests**
```typescript
// Test Script: test-rbac-permissions.js
const testCases = [
  {
    role: 'owner',
    organizationId: 'org1',
    departmentId: null,
    expectedPermissions: ['user:create', 'customer:delete', 'organization:manage'],
    deniedActions: []
  },
  {
    role: 'admin',
    organizationId: 'org1',
    departmentId: null,
    expectedPermissions: ['customer:create', 'deal:delete'],
    deniedActions: ['organization:manage']
  },
  {
    role: 'manager',
    organizationId: 'org1',
    departmentId: 'sales-dept',
    expectedPermissions: ['customer:read', 'deal:update'],
    deniedActions: ['user:create', 'customer:delete']
  },
  {
    role: 'employee',
    organizationId: 'org1',
    departmentId: 'sales-dept',
    expectedPermissions: ['customer:read', 'deal:read'],
    deniedActions: ['customer:create', 'deal:delete', 'user:create']
  }
];
```

### **1.2 Data Isolation Security Tests**

#### **Organization Isolation Tests**
```bash
# Test Case 1: Organization Data Leakage
# User from org1 tries to access org2 data

# Setup:
TOKEN_ORG1=$(get_auth_token "user-org1@prometric.kz")
TOKEN_ORG2=$(get_auth_token "user-org2@prometric.kz")

# Test: Org1 user tries to access Org2 customers
curl -H "Authorization: Bearer $TOKEN_ORG1" \
  "http://localhost:3333/api/v1/customers?organizationId=org2"

# Expected: 403 Forbidden

# Test: Direct database query injection attempt
curl -H "Authorization: Bearer $TOKEN_ORG1" \
  "http://localhost:3333/api/v1/customers" \
  -H "X-Organization-Id: org2"

# Expected: 403 Forbidden (OrganizationGuard should block)
```

#### **Department Isolation Tests**
```bash
# Test Case 2: Department Data Leakage
# Sales manager tries to access Marketing department data

TOKEN_SALES_MGR=$(get_auth_token "sales-manager@prometric.kz")

# Test: Sales manager tries to access Marketing customers
curl -H "Authorization: Bearer $TOKEN_SALES_MGR" \
  "http://localhost:3333/api/v1/customers?departmentId=marketing-dept"

# Expected: 403 Forbidden

# Test: Department bypass attempt via organizationId only
curl -H "Authorization: Bearer $TOKEN_SALES_MGR" \
  "http://localhost:3333/api/v1/customers?organizationId=org1"

# Expected: Only sales department customers returned
```

### **1.3 Penetration Testing**

#### **SQL Injection Tests**
```bash
# Test Case 3: SQL Injection Attempts
curl -X POST http://localhost:3333/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com'\'' OR 1=1--","password":"anything"}'

# Expected: Proper validation error, no SQL execution

# Test: Query parameter injection
curl "http://localhost:3333/api/v1/customers?organizationId=org1'; DROP TABLE customers;--"

# Expected: Validation error, no SQL execution
```

#### **CSRF Protection Tests**
```bash
# Test Case 4: Cross-Site Request Forgery
curl -X POST http://localhost:3333/api/v1/customers \
  -H "Origin: https://evil-site.com" \
  -H "Content-Type: application/json" \
  --cookie "access_token=VALID_TOKEN" \
  -d '{"name":"Evil Customer"}'

# Expected: CORS error due to invalid origin
```

---

## 🏗️ PHASE 2: DDD ARCHITECTURE TESTING

### **2.1 Domain Layer Unit Tests**

#### **Value Objects Tests**
```typescript
// File: src/domains/user-identity-access/authorization/domain/value-objects/__tests__/role-name.vo.spec.ts
describe('RoleName Value Object', () => {
  it('should create valid role names', () => {
    expect(RoleName.owner().getValue()).toBe('owner');
    expect(RoleName.admin().isAdmin()).toBe(true);
  });

  it('should reject invalid role names', () => {
    expect(() => RoleName.create('invalid')).toThrow('Invalid role name');
  });

  it('should provide correct permission checks', () => {
    expect(RoleName.owner().canManageUsers()).toBe(true);
    expect(RoleName.employee().canManageUsers()).toBe(false);
  });
});
```

#### **Domain Entities Tests**
```typescript
// File: src/domains/user-identity-access/authorization/domain/entities/__tests__/user-role.entity.spec.ts
describe('UserRole Entity', () => {
  it('should enforce business rules correctly', () => {
    const userRole = UserRole.create({
      userId: 'user1',
      organizationId: 'org1',
      departmentId: 'sales',
      roleName: RoleName.manager(),
      assignedBy: 'admin1'
    });

    expect(userRole.canAccessDepartmentData('org1', 'sales')).toBe(true);
    expect(userRole.canAccessDepartmentData('org1', 'marketing')).toBe(false);
  });

  it('should handle role expiration correctly', () => {
    const expiredRole = UserRole.create({
      userId: 'user1',
      organizationId: 'org1',
      roleName: RoleName.employee(),
      assignedBy: 'admin1',
      validUntil: new Date(Date.now() - 1000) // Expired
    });

    expect(expiredRole.isActive()).toBe(false);
  });
});
```

#### **Domain Services Tests**
```typescript
// File: src/domains/user-identity-access/authorization/domain/services/__tests__/authorization-domain.service.spec.ts
describe('AuthorizationDomainService', () => {
  it('should correctly evaluate permissions with context', () => {
    const service = new AuthorizationDomainService();
    const userRoles = [createManagerRole('sales-dept')];

    const hasPermission = service.hasPermission(
      userRoles,
      PermissionName.customerRead(),
      { organizationId: 'org1', departmentId: 'sales-dept' }
    );

    expect(hasPermission).toBe(true);
  });

  it('should deny cross-department access', () => {
    const service = new AuthorizationDomainService();
    const salesManagerRoles = [createManagerRole('sales-dept')];

    const hasPermission = service.hasPermission(
      salesManagerRoles,
      PermissionName.customerRead(),
      { organizationId: 'org1', departmentId: 'marketing-dept' }
    );

    expect(hasPermission).toBe(false);
  });
});
```

### **2.2 Application Layer Tests**

#### **CQRS Command Handler Tests**
```typescript
// File: src/domains/user-identity-access/authorization/application/commands/__tests__/assign-role.handler.spec.ts
describe('AssignRoleHandler', () => {
  it('should assign role successfully with proper validation', async () => {
    const handler = new AssignRoleHandler(
      mockUserRoleRepository,
      mockAuthorizationDomainService,
      mockEventBus
    );

    const command = new AssignRoleCommand(
      'user1', 'org1', 'manager', 'admin1'
    );

    await expect(handler.execute(command)).resolves.not.toThrow();
    expect(mockUserRoleRepository.save).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(RoleAssignedEvent)
    );
  });

  it('should prevent unauthorized role assignment', async () => {
    const handler = new AssignRoleHandler(
      mockUserRoleRepository,
      mockAuthorizationDomainService,
      mockEventBus
    );

    // Employee trying to assign admin role
    mockAuthorizationDomainService.canAssignRole.mockReturnValue(false);

    const command = new AssignRoleCommand(
      'user1', 'org1', 'admin', 'employee1'
    );

    await expect(handler.execute(command)).rejects.toThrow(
      'User employee1 cannot assign role admin'
    );
  });
});
```

#### **Query Handler Tests**
```typescript
// File: src/domains/user-identity-access/authorization/application/queries/__tests__/get-user-permissions.handler.spec.ts
describe('GetUserPermissionsHandler', () => {
  it('should return correct permissions for user role', async () => {
    const handler = new GetUserPermissionsHandler(
      mockUserRoleRepository,
      mockAuthorizationDomainService
    );

    const query = new GetUserPermissionsQuery('user1', 'org1');
    const result = await handler.execute(query);

    expect(result.permissions).toContain('customer:read');
    expect(result.permissions).not.toContain('organization:manage');
  });
});
```

---

## 🔌 PHASE 3: INTEGRATION TESTING

### **3.1 API Integration Tests**

#### **Authentication Flow Integration**
```typescript
// File: test/auth.e2e-spec.ts
describe('Authentication Flow (e2e)', () => {
  it('should complete full auth flow with HttpOnly cookies', async () => {
    // 1. Register new user
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'test@prometric.kz',
        password: 'TestPass123!',
        name: 'Test User'
      })
      .expect(201);

    // 2. Verify email (simulate)
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify')
      .send({
        email: 'test@prometric.kz',
        code: '123456' // Mock code
      })
      .expect(200);

    // 3. Login and get cookies
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'test@prometric.kz',
        password: 'TestPass123!'
      })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.includes('access_token'))).toBe(true);
    expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);

    // 4. Access protected endpoint with cookies
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookies)
      .expect(200);

    // 5. Refresh token
    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);

    const newCookies = refreshResponse.headers['set-cookie'];
    expect(newCookies).toBeDefined();

    // 6. Logout
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', newCookies)
      .expect(200);
  });
});
```

#### **RBAC Integration Tests**
```typescript
// File: test/rbac.e2e-spec.ts
describe('RBAC Integration (e2e)', () => {
  let ownerCookies: string[];
  let adminCookies: string[];
  let managerCookies: string[];
  let employeeCookies: string[];

  beforeAll(async () => {
    // Setup test users with different roles
    ownerCookies = await loginAs('owner@prometric.kz');
    adminCookies = await loginAs('admin@prometric.kz');
    managerCookies = await loginAs('manager@prometric.kz');
    employeeCookies = await loginAs('employee@prometric.kz');
  });

  it('should enforce role-based permissions correctly', async () => {
    // Owner can create users
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Cookie', ownerCookies)
      .send(mockUserData)
      .expect(201);

    // Employee cannot create users
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Cookie', employeeCookies)
      .send(mockUserData)
      .expect(403);

    // Manager can create customers in their department
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', managerCookies)
      .send({ ...mockCustomerData, departmentId: 'sales' })
      .expect(201);

    // Manager cannot create customers in other departments
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', managerCookies)
      .send({ ...mockCustomerData, departmentId: 'marketing' })
      .expect(403);
  });
});
```

### **3.2 Database Integration Tests**

#### **Department Isolation Database Tests**
```typescript
// File: test/database/department-isolation.spec.ts
describe('Department Isolation Database Tests', () => {
  it('should isolate customers by department', async () => {
    // Setup: Create customers in different departments
    await createCustomer('customer1', 'org1', 'sales');
    await createCustomer('customer2', 'org1', 'marketing');
    await createCustomer('customer3', 'org2', 'sales');

    // Test: Sales manager from org1 should only see sales customers from org1
    const salesManagerRole = await createUserRole('sales-manager', 'org1', 'sales');
    const customers = await customerRepository.findByUserRole(salesManagerRole);

    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('customer1');
    expect(customers[0].departmentId).toBe('sales');
    expect(customers[0].organizationId).toBe('org1');
  });

  it('should prevent cross-organization data access', async () => {
    const user1Role = await createUserRole('manager', 'org1', 'sales');
    const user2Role = await createUserRole('manager', 'org2', 'sales');

    const org1Customers = await customerRepository.findByUserRole(user1Role);
    const org2Customers = await customerRepository.findByUserRole(user2Role);

    // Verify no overlap
    const org1CustomerIds = org1Customers.map(c => c.id);
    const org2CustomerIds = org2Customers.map(c => c.id);

    expect(org1CustomerIds.some(id => org2CustomerIds.includes(id))).toBe(false);
  });
});
```

### **3.3 Frontend-Backend Integration Tests**

#### **Cookie Handling Tests**
```javascript
// File: frontend/test/integration/cookie-auth.test.js
describe('Frontend Cookie Authentication', () => {
  it('should handle HttpOnly cookies correctly', async () => {
    // Mock backend login endpoint
    fetchMock.post('/api/v1/auth/login', {
      status: 200,
      headers: {
        'Set-Cookie': [
          'access_token=mock_token; HttpOnly; Secure; SameSite=strict',
          'refresh_token=mock_refresh; HttpOnly; Secure; SameSite=strict'
        ]
      },
      body: { user: mockUser }
    });

    // Test login
    const { getByTestId } = render(<LoginForm />);

    await userEvent.type(getByTestId('email-input'), 'test@example.com');
    await userEvent.type(getByTestId('password-input'), 'password123');
    await userEvent.click(getByTestId('login-button'));

    // Verify subsequent API calls include credentials
    expect(fetchMock.calls('/api/v1/customers')).toHaveLength(1);
    expect(fetchMock.lastOptions('/api/v1/customers').credentials).toBe('include');
  });

  it('should handle auto-refresh on 401', async () => {
    // Mock expired token scenario
    fetchMock
      .get('/api/v1/customers', { status: 401 }, { overwriteRoutes: false })
      .post('/api/v1/auth/refresh', { status: 200 })
      .get('/api/v1/customers', { status: 200, body: mockCustomers }, {
        overwriteRoutes: false
      });

    await apiCall('/customers');

    // Verify refresh was called and request retried
    expect(fetchMock.calls('/api/v1/auth/refresh')).toHaveLength(1);
    expect(fetchMock.calls('/api/v1/customers')).toHaveLength(2);
  });
});
```

---

## 🎭 PHASE 4: STRESS & PERFORMANCE TESTING

### **4.1 Load Testing**

#### **Concurrent Authentication Tests**
```bash
# Test: Concurrent login attempts
artillery run --config artillery-auth.yml

# artillery-auth.yml:
config:
  target: 'http://localhost:3333'
  phases:
    - duration: 60
      arrivalRate: 100
scenarios:
  - name: "Concurrent Auth"
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "{{ $randomEmail() }}"
            password: "TestPass123!"
      - think: 1
      - get:
          url: "/api/v1/auth/me"
```

#### **Department Isolation Performance Tests**
```bash
# Test: Large dataset department filtering performance
npm run test:performance

# Script measures:
# - Query time for large customer datasets (10K+ records)
# - Memory usage during department filtering
# - Database connection pool utilization
# - Response time under concurrent department queries
```

### **4.2 Memory Leak Tests**

#### **Long-running Session Tests**
```typescript
// File: test/performance/memory-leak.spec.ts
describe('Memory Leak Tests', () => {
  it('should not leak memory during extended auth sessions', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Simulate 1000 auth operations
    for (let i = 0; i < 1000; i++) {
      await authService.login('test@example.com', 'password');
      await authService.refresh('mock_refresh_token');
      await authService.logout();

      if (i % 100 === 0) {
        global.gc(); // Force garbage collection
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be minimal (< 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

---

## 🤖 PHASE 5: AI SERVICES TESTING

### **5.1 RAG System Tests**

#### **Organization-specific Knowledge Tests**
```typescript
// File: test/ai/rag-isolation.spec.ts
describe('RAG Organization Isolation', () => {
  it('should return only organization-specific knowledge', async () => {
    // Setup: Add knowledge documents for different orgs
    await knowledgeService.addDocument('org1', 'Sales Process Guide', 'sales-content');
    await knowledgeService.addDocument('org2', 'Sales Process Guide', 'different-sales-content');

    // Test: Org1 user searches for sales info
    const org1Results = await ragService.search('sales process', {
      userId: 'user1',
      organizationId: 'org1'
    });

    expect(org1Results).toContain('sales-content');
    expect(org1Results).not.toContain('different-sales-content');
  });

  it('should filter by department when applicable', async () => {
    await knowledgeService.addDocument('org1', 'Marketing Guide', 'marketing-content', 'marketing');
    await knowledgeService.addDocument('org1', 'Sales Guide', 'sales-content', 'sales');

    const salesManagerResults = await ragService.search('guide', {
      userId: 'sales-manager',
      organizationId: 'org1',
      departmentId: 'sales'
    });

    expect(salesManagerResults).toContain('sales-content');
    expect(salesManagerResults).not.toContain('marketing-content');
  });
});
```

### **5.2 AI Chat Context Tests**

#### **Conversation Isolation Tests**
```typescript
// File: test/ai/conversation-isolation.spec.ts
describe('AI Conversation Isolation', () => {
  it('should maintain separate conversation contexts per organization', async () => {
    // Start conversations for different organizations
    const org1Session = await conversationService.startSession('user1', 'org1');
    const org2Session = await conversationService.startSession('user2', 'org2');

    // Add context to each session
    await conversationService.addMessage(org1Session.id, 'user', 'Our top customer is ACME Corp');
    await conversationService.addMessage(org2Session.id, 'user', 'Our top customer is XYZ Inc');

    // Test: Each conversation should only have access to its own context
    const org1Response = await aiService.chat('Who is our top customer?', {
      sessionId: org1Session.id,
      organizationId: 'org1'
    });

    const org2Response = await aiService.chat('Who is our top customer?', {
      sessionId: org2Session.id,
      organizationId: 'org2'
    });

    expect(org1Response).toContain('ACME Corp');
    expect(org1Response).not.toContain('XYZ Inc');
    expect(org2Response).toContain('XYZ Inc');
    expect(org2Response).not.toContain('ACME Corp');
  });
});
```

---

## 📊 PHASE 6: END-TO-END SCENARIOS

### **6.1 Complete User Journey Tests**

#### **New Organization Onboarding**
```typescript
// File: test/e2e/organization-onboarding.spec.ts
describe('Complete Organization Onboarding Journey', () => {
  it('should handle full onboarding flow', async () => {
    // 1. Organization registration
    const orgResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .send({
        name: 'Test Corp',
        email: 'admin@testcorp.com',
        password: 'SecurePass123!'
      })
      .expect(201);

    const { organizationId, userId } = orgResponse.body;

    // 2. Email verification
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify')
      .send({ email: 'admin@testcorp.com', code: 'mock-code' })
      .expect(200);

    // 3. First login (should get owner role automatically)
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@testcorp.com', password: 'SecurePass123!' })
      .expect(200);

    const cookies = loginResponse.headers['set-cookie'];

    // 4. Create departments
    await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Cookie', cookies)
      .send({ name: 'Sales', type: 'sales' })
      .expect(201);

    // 5. Invite team members
    await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Cookie', cookies)
      .send({
        email: 'manager@testcorp.com',
        role: 'manager',
        departmentId: 'sales'
      })
      .expect(201);

    // 6. Add first customer
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', cookies)
      .send({
        name: 'First Customer',
        email: 'customer@example.com',
        departmentId: 'sales'
      })
      .expect(201);

    // 7. Verify data isolation
    const customersResponse = await request(app.getHttpServer())
      .get('/api/v1/customers')
      .set('Cookie', cookies)
      .expect(200);

    expect(customersResponse.body).toHaveLength(1);
    expect(customersResponse.body[0].organizationId).toBe(organizationId);
  });
});
```

### **6.2 Multi-user Collaboration Tests**

#### **Department Collaboration Scenario**
```typescript
// File: test/e2e/department-collaboration.spec.ts
describe('Department Collaboration Scenarios', () => {
  it('should handle cross-department workflows correctly', async () => {
    // Setup: Create users in different departments
    const salesManagerCookies = await loginAs('sales-manager@testcorp.com');
    const marketingManagerCookies = await loginAs('marketing-manager@testcorp.com');
    const ownerCookies = await loginAs('owner@testcorp.com');

    // Marketing creates a lead
    const leadResponse = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Cookie', marketingManagerCookies)
      .send({
        name: 'Qualified Lead',
        email: 'lead@prospect.com',
        source: 'Website',
        departmentId: 'marketing'
      })
      .expect(201);

    // Marketing cannot convert lead to customer (needs sales)
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', marketingManagerCookies)
      .send({
        name: 'Qualified Lead',
        email: 'lead@prospect.com',
        departmentId: 'sales' // Cross-department
      })
      .expect(403);

    // Owner transfers lead to sales
    await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadResponse.body.id}/transfer`)
      .set('Cookie', ownerCookies)
      .send({ toDepartment: 'sales' })
      .expect(200);

    // Sales manager can now access and convert the lead
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', salesManagerCookies)
      .send({
        name: 'Qualified Lead',
        email: 'lead@prospect.com',
        departmentId: 'sales'
      })
      .expect(201);
  });
});
```

---

## 🚨 PHASE 7: DISASTER RECOVERY TESTING

### **7.1 Database Failure Scenarios**

#### **Connection Loss Recovery**
```typescript
// File: test/disaster/database-recovery.spec.ts
describe('Database Disaster Recovery', () => {
  it('should handle database connection loss gracefully', async () => {
    // Simulate database connection loss
    await dataSource.destroy();

    // API calls should return 503 Service Unavailable
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);

    // Restore connection
    await dataSource.initialize();

    // Health should recover
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
  });

  it('should handle partial database corruption', async () => {
    // Simulate corrupted user_roles table
    await dataSource.query('DROP TABLE user_roles');

    // System should degrade gracefully
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', validCookies)
      .expect(503); // Service unavailable, not crash

    // Health check should report degraded state
    const healthResponse = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(healthResponse.body.status).toBe('degraded');
  });
});
```

### **7.2 AI Service Failure Scenarios**

#### **OpenAI API Unavailability**
```typescript
// File: test/disaster/ai-service-recovery.spec.ts
describe('AI Service Disaster Recovery', () => {
  it('should handle OpenAI API failures gracefully', async () => {
    // Mock OpenAI API failure
    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(500, 'Internal Server Error');

    // AI chat should return graceful error
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set('Cookie', validCookies)
      .send({ message: 'Hello' })
      .expect(503);

    expect(response.body.message).toBe('AI service temporarily unavailable');

    // Health check should report AI service as unhealthy
    const healthResponse = await request(app.getHttpServer())
      .get('/api/v1/health/detailed')
      .expect(200);

    expect(healthResponse.body.components['ai-service'].status).toBe('unhealthy');
  });
});
```

---

## 📈 TESTING METRICS & SUCCESS CRITERIA

### **Coverage Requirements**
- **Unit Tests**: ≥ 90% code coverage
- **Integration Tests**: ≥ 85% API endpoint coverage
- **E2E Tests**: ≥ 80% user journey coverage
- **Security Tests**: 100% critical endpoint coverage

### **Performance Benchmarks**
- **API Response Time**: < 200ms for 95th percentile
- **Database Query Time**: < 50ms for simple queries
- **Memory Usage**: < 512MB under normal load
- **Concurrent Users**: Support 100+ simultaneous sessions

### **Security Success Criteria**
- **Zero Data Leakage**: No cross-organization or cross-department data access
- **Authentication Security**: All auth flows secure against common attacks
- **Permission Enforcement**: 100% RBAC rule compliance
- **Input Validation**: All inputs properly sanitized

---

## 🎯 EXECUTION TIMELINE

### **Day 1-2: Security & RBAC Testing**
- HttpOnly cookies testing
- RBAC permission matrix validation
- Data isolation verification
- Penetration testing

### **Day 3: DDD Architecture Testing**
- Domain layer unit tests
- Application layer integration tests
- Repository pattern validation

### **Day 4: Integration & Performance Testing**
- Frontend-backend integration
- Database performance tests
- Load testing scenarios

### **Day 5: AI Services & E2E Testing**
- RAG system isolation tests
- Complete user journey testing
- Multi-user collaboration scenarios

### **Day 6-7: Disaster Recovery & Final Validation**
- Failure scenario testing
- Performance optimization
- Final security audit

**READY FOR PRODUCTION: После успешного прохождения всех тестов**
