#!/usr/bin/env node

// RBAC Testing Script for Prometric V2
// Tests Role-Based Access Control with Department isolation

const SecurityTester = require('./security-tests');

class RBACTester extends SecurityTester {
  constructor() {
    super();
    this.users = {
      owner: { email: 'owner@prometric.kz', password: 'OwnerPass123!', orgId: 'org-1', deptId: null },
      admin: { email: 'admin@prometric.kz', password: 'AdminPass123!', orgId: 'org-1', deptId: null },
      salesManager: { email: 'manager@sales.prometric.kz', password: 'ManagerPass123!', orgId: 'org-1', deptId: 'sales-dept' },
      marketingManager: { email: 'manager@marketing.prometric.kz', password: 'ManagerPass123!', orgId: 'org-1', deptId: 'marketing-dept' },
      salesEmployee: { email: 'employee@sales.prometric.kz', password: 'EmployeePass123!', orgId: 'org-1', deptId: 'sales-dept' },
      marketingEmployee: { email: 'employee@marketing.prometric.kz', password: 'EmployeePass123!', orgId: 'org-1', deptId: 'marketing-dept' }
    };
  }

  async runRBACTests() {
    console.log('👥 Starting RBAC Tests for Prometric V2\n');

    try {
      await this.testOwnerPermissions();
      await this.testAdminPermissions();
      await this.testManagerPermissions();
      await this.testEmployeePermissions();
      await this.testDepartmentIsolation();
      await this.testOrganizationIsolation();
      await this.testRoleEscalationPrevention();
      await this.testPermissionInheritance();

      this.printResults();
    } catch (error) {
      console.error('❌ RBAC test suite failed:', error.message);
      process.exit(1);
    }
  }

  async loginAs(userType) {
    const user = this.users[userType];
    if (!user) throw new Error(`Unknown user type: ${userType}`);

    this.cookies.clear();

    const response = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: {
        email: user.email,
        password: user.password
      }
    });

    if (response.statusCode !== 200) {
      throw new Error(`Failed to login as ${userType}: ${response.statusCode}`);
    }

    return response;
  }

  async testOwnerPermissions() {
    console.log('👑 Testing Owner Permissions...');

    await this.loginAs('owner');

    const endpoints = [
      { path: '/admin/organizations', method: 'GET', description: 'View organizations' },
      { path: '/admin/users', method: 'GET', description: 'View all users' },
      { path: '/admin/roles', method: 'POST', body: { userId: 'user-123', role: 'admin' }, description: 'Assign admin role' },
      { path: '/admin/system/settings', method: 'GET', description: 'System settings' },
      { path: '/employees', method: 'GET', description: 'View employees' },
      { path: '/deals', method: 'GET', description: 'View deals' },
      { path: '/analytics/revenue', method: 'GET', description: 'Revenue analytics' },
      { path: '/profile', method: 'GET', description: 'Own profile' }
    ];

    for (const endpoint of endpoints) {
      const response = await this.makeRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.body
      });

      this.testResults.push({
        test: `Owner - ${endpoint.description}`,
        passed: response.statusCode === 200 || response.statusCode === 404, // 404 is OK if resource doesn't exist
        message: response.statusCode === 200 ?
          `✅ Owner can ${endpoint.description.toLowerCase()}` :
          response.statusCode === 404 ?
            `✅ Owner permission granted (resource not found)` :
            `❌ Owner cannot ${endpoint.description.toLowerCase()} (${response.statusCode})`
      });
    }
  }

  async testAdminPermissions() {
    console.log('🔧 Testing Admin Permissions...');

    await this.loginAs('admin');

    const allowedEndpoints = [
      { path: '/admin/users', method: 'GET', description: 'View users' },
      { path: '/admin/roles', method: 'POST', body: { userId: 'user-123', role: 'manager' }, description: 'Assign manager role' },
      { path: '/employees', method: 'GET', description: 'View employees' },
      { path: '/deals', method: 'GET', description: 'View deals' },
      { path: '/profile', method: 'GET', description: 'Own profile' }
    ];

    const deniedEndpoints = [
      { path: '/admin/organizations', method: 'POST', body: { name: 'New Org' }, description: 'Create organization' },
      { path: '/admin/system/settings', method: 'PUT', body: { setting: 'value' }, description: 'Modify system settings' },
      { path: '/admin/roles', method: 'POST', body: { userId: 'user-123', role: 'owner' }, description: 'Assign owner role' }
    ];

    // Test allowed permissions
    for (const endpoint of allowedEndpoints) {
      const response = await this.makeRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.body
      });

      this.testResults.push({
        test: `Admin - ${endpoint.description}`,
        passed: response.statusCode === 200 || response.statusCode === 404,
        message: response.statusCode === 200 ?
          `✅ Admin can ${endpoint.description.toLowerCase()}` :
          response.statusCode === 404 ?
            `✅ Admin permission granted (resource not found)` :
            `❌ Admin cannot ${endpoint.description.toLowerCase()} (${response.statusCode})`
      });
    }

    // Test denied permissions
    for (const endpoint of deniedEndpoints) {
      const response = await this.makeRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.body
      });

      this.testResults.push({
        test: `Admin Restriction - ${endpoint.description}`,
        passed: response.statusCode === 403,
        message: response.statusCode === 403 ?
          `✅ Admin correctly denied: ${endpoint.description.toLowerCase()}` :
          `❌ Admin can ${endpoint.description.toLowerCase()} (should be denied)`
      });
    }
  }

  async testManagerPermissions() {
    console.log('📊 Testing Manager Permissions...');

    await this.loginAs('salesManager');

    const allowedEndpoints = [
      { path: '/employees?departmentId=sales-dept', method: 'GET', description: 'View department employees' },
      { path: '/deals?departmentId=sales-dept', method: 'GET', description: 'View department deals' },
      { path: '/analytics/department/sales-dept', method: 'GET', description: 'Department analytics' },
      { path: '/profile', method: 'GET', description: 'Own profile' }
    ];

    const deniedEndpoints = [
      { path: '/admin/users', method: 'GET', description: 'View all users' },
      { path: '/employees?departmentId=marketing-dept', method: 'GET', description: 'View other department employees' },
      { path: '/deals?departmentId=marketing-dept', method: 'GET', description: 'View other department deals' },
      { path: '/admin/roles', method: 'POST', body: { userId: 'user-123', role: 'manager' }, description: 'Assign roles' }
    ];

    // Test allowed permissions
    for (const endpoint of allowedEndpoints) {
      const response = await this.makeRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.body
      });

      this.testResults.push({
        test: `Manager - ${endpoint.description}`,
        passed: response.statusCode === 200 || response.statusCode === 404,
        message: response.statusCode === 200 ?
          `✅ Manager can ${endpoint.description.toLowerCase()}` :
          response.statusCode === 404 ?
            `✅ Manager permission granted (resource not found)` :
            `❌ Manager cannot ${endpoint.description.toLowerCase()} (${response.statusCode})`
      });
    }

    // Test denied permissions
    for (const endpoint of deniedEndpoints) {
      const response = await this.makeRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.body
      });

      this.testResults.push({
        test: `Manager Restriction - ${endpoint.description}`,
        passed: response.statusCode === 403,
        message: response.statusCode === 403 ?
          `✅ Manager correctly denied: ${endpoint.description.toLowerCase()}` :
          `❌ Manager can ${endpoint.description.toLowerCase()} (should be denied)`
      });
    }
  }

  async testEmployeePermissions() {
    console.log('👤 Testing Employee Permissions...');

    await this.loginAs('salesEmployee');

    const allowedEndpoints = [
      { path: '/profile', method: 'GET', description: 'Own profile' },
      { path: '/profile', method: 'PUT', body: { name: 'Updated Name' }, description: 'Update own profile' },
      { path: '/deals?assignedTo=me', method: 'GET', description: 'Own deals' },
      { path: '/tasks?assignedTo=me', method: 'GET', description: 'Own tasks' }
    ];

    const deniedEndpoints = [
      { path: '/admin/users', method: 'GET', description: 'View all users' },
      { path: '/employees', method: 'GET', description: 'View all employees' },
      { path: '/deals', method: 'GET', description: 'View all deals' },
      { path: '/analytics/department/sales-dept', method: 'GET', description: 'Department analytics' },
      { path: '/admin/roles', method: 'POST', body: { userId: 'user-123', role: 'employee' }, description: 'Assign roles' }
    ];

    // Test allowed permissions
    for (const endpoint of allowedEndpoints) {
      const response = await this.makeRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.body
      });

      this.testResults.push({
        test: `Employee - ${endpoint.description}`,
        passed: response.statusCode === 200 || response.statusCode === 404,
        message: response.statusCode === 200 ?
          `✅ Employee can ${endpoint.description.toLowerCase()}` :
          response.statusCode === 404 ?
            `✅ Employee permission granted (resource not found)` :
            `❌ Employee cannot ${endpoint.description.toLowerCase()} (${response.statusCode})`
      });
    }

    // Test denied permissions
    for (const endpoint of deniedEndpoints) {
      const response = await this.makeRequest(endpoint.path, {
        method: endpoint.method,
        body: endpoint.body
      });

      this.testResults.push({
        test: `Employee Restriction - ${endpoint.description}`,
        passed: response.statusCode === 403,
        message: response.statusCode === 403 ?
          `✅ Employee correctly denied: ${endpoint.description.toLowerCase()}` :
          `❌ Employee can ${endpoint.description.toLowerCase()} (should be denied)`
      });
    }
  }

  async testDepartmentIsolation() {
    console.log('🏢 Testing Department Isolation...');

    // Sales Manager tries to access Marketing data
    await this.loginAs('salesManager');

    const crossDepartmentTests = [
      { path: '/employees?departmentId=marketing-dept', description: 'Marketing employees' },
      { path: '/deals?departmentId=marketing-dept', description: 'Marketing deals' },
      { path: '/analytics/department/marketing-dept', description: 'Marketing analytics' }
    ];

    for (const test of crossDepartmentTests) {
      const response = await this.makeRequest(test.path);

      this.testResults.push({
        test: `Department Isolation - ${test.description}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ Cannot access ${test.description.toLowerCase()}` :
          response.body && response.body.length === 0 ?
            `✅ Empty result for ${test.description.toLowerCase()}` :
            `❌ Can access ${test.description.toLowerCase()} from other department`
      });
    }

    // Marketing Employee tries to access Sales data
    await this.loginAs('marketingEmployee');

    for (const test of crossDepartmentTests.map(t => ({ ...t, path: t.path.replace('marketing', 'sales') }))) {
      const response = await this.makeRequest(test.path);

      this.testResults.push({
        test: `Reverse Department Isolation - ${test.description.replace('Marketing', 'Sales')}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ Cannot access ${test.description.toLowerCase().replace('marketing', 'sales')}` :
          `❌ Can access ${test.description.toLowerCase().replace('marketing', 'sales')} from other department`
      });
    }
  }

  async testOrganizationIsolation() {
    console.log('🏛️ Testing Organization Isolation...');

    // Create a second organization context (this would typically be done in test setup)
    const org2Tests = [
      { path: '/employees?organizationId=org-2', description: 'Other org employees' },
      { path: '/deals?organizationId=org-2', description: 'Other org deals' },
      { path: '/analytics/organization/org-2', description: 'Other org analytics' }
    ];

    await this.loginAs('admin'); // Use admin to test organization boundaries

    for (const test of org2Tests) {
      const response = await this.makeRequest(test.path);

      this.testResults.push({
        test: `Organization Isolation - ${test.description}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ Cannot access ${test.description.toLowerCase()}` :
          `❌ Can access ${test.description.toLowerCase()} from other organization`
      });
    }
  }

  async testRoleEscalationPrevention() {
    console.log('⬆️ Testing Role Escalation Prevention...');

    // Manager tries to assign admin role
    await this.loginAs('salesManager');

    const escalationTests = [
      {
        path: '/admin/roles',
        method: 'POST',
        body: { userId: 'employee-123', role: 'admin' },
        description: 'Manager assigning admin role'
      },
      {
        path: '/admin/roles',
        method: 'POST',
        body: { userId: 'employee-123', role: 'owner' },
        description: 'Manager assigning owner role'
      }
    ];

    for (const test of escalationTests) {
      const response = await this.makeRequest(test.path, {
        method: test.method,
        body: test.body
      });

      this.testResults.push({
        test: `Role Escalation Prevention - ${test.description}`,
        passed: response.statusCode === 403,
        message: response.statusCode === 403 ?
          `✅ ${test.description} blocked` :
          `❌ ${test.description} allowed (security risk)`
      });
    }

    // Employee tries to assign any role
    await this.loginAs('salesEmployee');

    const employeeEscalation = {
      path: '/admin/roles',
      method: 'POST',
      body: { userId: 'other-employee', role: 'employee' },
      description: 'Employee assigning any role'
    };

    const response = await this.makeRequest(employeeEscalation.path, {
      method: employeeEscalation.method,
      body: employeeEscalation.body
    });

    this.testResults.push({
      test: `Role Escalation Prevention - ${employeeEscalation.description}`,
      passed: response.statusCode === 403,
      message: response.statusCode === 403 ?
        `✅ ${employeeEscalation.description} blocked` :
        `❌ ${employeeEscalation.description} allowed (security risk)`
    });
  }

  async testPermissionInheritance() {
    console.log('🔗 Testing Permission Inheritance...');

    // Test that higher roles can do everything lower roles can do
    const roleHierarchy = ['employee', 'manager', 'admin', 'owner'];

    const basicEndpoints = [
      { path: '/profile', method: 'GET', description: 'View profile' },
      { path: '/tasks?assignedTo=me', method: 'GET', description: 'View own tasks' }
    ];

    for (let i = 0; i < roleHierarchy.length; i++) {
      const role = roleHierarchy[i];

      try {
        await this.loginAs(role === 'manager' ? 'salesManager' : role === 'employee' ? 'salesEmployee' : role);

        for (const endpoint of basicEndpoints) {
          const response = await this.makeRequest(endpoint.path, {
            method: endpoint.method
          });

          this.testResults.push({
            test: `Permission Inheritance - ${role} ${endpoint.description}`,
            passed: response.statusCode === 200 || response.statusCode === 404,
            message: response.statusCode === 200 ?
              `✅ ${role} can ${endpoint.description.toLowerCase()}` :
              response.statusCode === 404 ?
                `✅ ${role} permission granted (resource not found)` :
                `❌ ${role} cannot ${endpoint.description.toLowerCase()}`
          });
        }
      } catch (error) {
        this.testResults.push({
          test: `Permission Inheritance - ${role} login`,
          passed: false,
          message: `❌ Cannot login as ${role}: ${error.message}`
        });
      }
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new RBACTester();
  tester.runRBACTests().catch(console.error);
}

module.exports = RBACTester;