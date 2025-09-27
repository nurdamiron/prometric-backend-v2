#!/usr/bin/env node

// Data Isolation Testing Script for Prometric V2
// Tests organization and department data isolation

const SecurityTester = require('./security-tests');

class DataIsolationTester extends SecurityTester {
  constructor() {
    super();
    this.testOrganizations = {
      orgA: {
        id: 'org-a-uuid',
        users: {
          owner: { email: 'owner@org-a.com', password: 'OwnerA123!' },
          admin: { email: 'admin@org-a.com', password: 'AdminA123!' },
          salesManager: { email: 'manager@sales.org-a.com', password: 'ManagerA123!' },
          salesEmployee: { email: 'employee@sales.org-a.com', password: 'EmployeeA123!' }
        }
      },
      orgB: {
        id: 'org-b-uuid',
        users: {
          owner: { email: 'owner@org-b.com', password: 'OwnerB123!' },
          admin: { email: 'admin@org-b.com', password: 'AdminB123!' },
          salesManager: { email: 'manager@sales.org-b.com', password: 'ManagerB123!' },
          salesEmployee: { email: 'employee@sales.org-b.com', password: 'EmployeeB123!' }
        }
      }
    };

    this.testDepartments = {
      sales: 'sales-dept-uuid',
      marketing: 'marketing-dept-uuid',
      support: 'support-dept-uuid'
    };
  }

  async runDataIsolationTests() {
    console.log('🔒 Starting Data Isolation Tests for Prometric V2\n');

    try {
      await this.testOrganizationDataIsolation();
      await this.testDepartmentDataIsolation();
      await this.testCrossTenantLeakage();
      await this.testQueryParameterManipulation();
      await this.testHeaderManipulation();
      await this.testAPIEndpointIsolation();
      await this.testDatabaseQueryIsolation();
      await this.testAIDataIsolation();

      this.printResults();
    } catch (error) {
      console.error('❌ Data isolation test suite failed:', error.message);
      process.exit(1);
    }
  }

  async loginAsOrgUser(orgKey, userType) {
    const org = this.testOrganizations[orgKey];
    const user = org.users[userType];

    if (!user) throw new Error(`User ${userType} not found in organization ${orgKey}`);

    this.cookies.clear();

    const response = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: {
        email: user.email,
        password: user.password
      }
    });

    if (response.statusCode !== 200) {
      throw new Error(`Failed to login as ${userType} in ${orgKey}: ${response.statusCode}`);
    }

    return response;
  }

  async testOrganizationDataIsolation() {
    console.log('🏛️ Testing Organization Data Isolation...');

    // Login as Org A admin
    await this.loginAsOrgUser('orgA', 'admin');

    const orgBDataEndpoints = [
      { path: '/employees', query: `organizationId=${this.testOrganizations.orgB.id}`, description: 'Org B employees' },
      { path: '/deals', query: `organizationId=${this.testOrganizations.orgB.id}`, description: 'Org B deals' },
      { path: '/customers', query: `organizationId=${this.testOrganizations.orgB.id}`, description: 'Org B customers' },
      { path: '/analytics/revenue', query: `organizationId=${this.testOrganizations.orgB.id}`, description: 'Org B revenue' },
      { path: '/conversations', query: `organizationId=${this.testOrganizations.orgB.id}`, description: 'Org B conversations' }
    ];

    for (const endpoint of orgBDataEndpoints) {
      const fullPath = `${endpoint.path}?${endpoint.query}`;
      const response = await this.makeRequest(fullPath);

      this.testResults.push({
        test: `Organization Isolation - ${endpoint.description}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ Access to ${endpoint.description.toLowerCase()} blocked` :
          response.body && response.body.length === 0 ?
            `✅ Empty result for ${endpoint.description.toLowerCase()}` :
            `❌ Can access ${endpoint.description.toLowerCase()} from other organization`
      });
    }

    // Test reverse isolation - Org B admin trying to access Org A data
    await this.loginAsOrgUser('orgB', 'admin');

    const orgADataEndpoints = orgBDataEndpoints.map(endpoint => ({
      ...endpoint,
      query: endpoint.query.replace(this.testOrganizations.orgB.id, this.testOrganizations.orgA.id),
      description: endpoint.description.replace('Org B', 'Org A')
    }));

    for (const endpoint of orgADataEndpoints) {
      const fullPath = `${endpoint.path}?${endpoint.query}`;
      const response = await this.makeRequest(fullPath);

      this.testResults.push({
        test: `Reverse Organization Isolation - ${endpoint.description}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ Access to ${endpoint.description.toLowerCase()} blocked` :
          `❌ Can access ${endpoint.description.toLowerCase()} from other organization`
      });
    }
  }

  async testDepartmentDataIsolation() {
    console.log('🏢 Testing Department Data Isolation...');

    // Login as Sales Manager
    await this.loginAsOrgUser('orgA', 'salesManager');

    const otherDepartmentEndpoints = [
      { path: '/employees', query: `departmentId=${this.testDepartments.marketing}`, description: 'Marketing employees' },
      { path: '/deals', query: `departmentId=${this.testDepartments.marketing}`, description: 'Marketing deals' },
      { path: '/tasks', query: `departmentId=${this.testDepartments.support}`, description: 'Support tasks' },
      { path: '/analytics/performance', query: `departmentId=${this.testDepartments.marketing}`, description: 'Marketing performance' }
    ];

    for (const endpoint of otherDepartmentEndpoints) {
      const fullPath = `${endpoint.path}?${endpoint.query}`;
      const response = await this.makeRequest(fullPath);

      this.testResults.push({
        test: `Department Isolation - ${endpoint.description}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ Sales manager cannot access ${endpoint.description.toLowerCase()}` :
          `❌ Sales manager can access ${endpoint.description.toLowerCase()}`
      });
    }

    // Test that manager CAN access their own department data
    const ownDepartmentEndpoints = [
      { path: '/employees', query: `departmentId=${this.testDepartments.sales}`, description: 'Own department employees' },
      { path: '/deals', query: `departmentId=${this.testDepartments.sales}`, description: 'Own department deals' },
      { path: '/analytics/performance', query: `departmentId=${this.testDepartments.sales}`, description: 'Own department performance' }
    ];

    for (const endpoint of ownDepartmentEndpoints) {
      const fullPath = `${endpoint.path}?${endpoint.query}`;
      const response = await this.makeRequest(fullPath);

      this.testResults.push({
        test: `Department Access - ${endpoint.description}`,
        passed: response.statusCode === 200 || response.statusCode === 404,
        message: response.statusCode === 200 ?
          `✅ Manager can access ${endpoint.description.toLowerCase()}` :
          response.statusCode === 404 ?
            `✅ Permission granted for ${endpoint.description.toLowerCase()} (not found)` :
            `❌ Manager cannot access ${endpoint.description.toLowerCase()}`
      });
    }
  }

  async testCrossTenantLeakage() {
    console.log('🚫 Testing Cross-Tenant Data Leakage...');

    // Login as employee from Org A
    await this.loginAsOrgUser('orgA', 'salesEmployee');

    // Try various ways to access Org B data
    const leakageTests = [
      {
        method: 'POST',
        path: '/graphql',
        body: {
          query: `query { employees(organizationId: "${this.testOrganizations.orgB.id}") { id name email } }`
        },
        description: 'GraphQL query for other org data'
      },
      {
        method: 'GET',
        path: '/search',
        query: `q=*&organizationId=${this.testOrganizations.orgB.id}`,
        description: 'Search in other organization'
      },
      {
        method: 'POST',
        path: '/employees/batch',
        body: {
          organizationIds: [this.testOrganizations.orgA.id, this.testOrganizations.orgB.id]
        },
        description: 'Batch request including other org'
      },
      {
        method: 'GET',
        path: '/reports/cross-organization',
        query: `orgs=${this.testOrganizations.orgA.id},${this.testOrganizations.orgB.id}`,
        description: 'Cross-organization report'
      }
    ];

    for (const test of leakageTests) {
      const fullPath = test.query ? `${test.path}?${test.query}` : test.path;
      const response = await this.makeRequest(fullPath, {
        method: test.method,
        body: test.body
      });

      this.testResults.push({
        test: `Cross-Tenant Leakage - ${test.description}`,
        passed: response.statusCode === 403 || response.statusCode === 400 ||
                (response.body && !this.containsOrgBData(response.body)),
        message: response.statusCode === 403 ?
          `✅ ${test.description} blocked` :
          response.statusCode === 400 ?
            `✅ ${test.description} rejected (bad request)` :
            `❌ Potential data leakage in ${test.description}`
      });
    }
  }

  containsOrgBData(responseBody) {
    const serialized = JSON.stringify(responseBody).toLowerCase();
    return serialized.includes('org-b') || serialized.includes('@org-b.com');
  }

  async testQueryParameterManipulation() {
    console.log('🔍 Testing Query Parameter Manipulation...');

    await this.loginAsOrgUser('orgA', 'salesEmployee');

    const manipulationTests = [
      {
        path: '/employees',
        params: { organizationId: this.testOrganizations.orgB.id },
        description: 'organizationId parameter manipulation'
      },
      {
        path: '/deals',
        params: {
          organizationId: this.testOrganizations.orgA.id,
          departmentId: this.testDepartments.marketing
        },
        description: 'Cross-department access via parameters'
      },
      {
        path: '/customers',
        params: {
          orgId: this.testOrganizations.orgB.id,
          organizationId: this.testOrganizations.orgA.id
        },
        description: 'Conflicting organization parameters'
      },
      {
        path: '/analytics',
        params: {
          'filter[organization_id]': this.testOrganizations.orgB.id
        },
        description: 'Filter-based organization manipulation'
      }
    ];

    for (const test of manipulationTests) {
      const queryString = new URLSearchParams(test.params).toString();
      const fullPath = `${test.path}?${queryString}`;

      const response = await this.makeRequest(fullPath);

      this.testResults.push({
        test: `Query Manipulation - ${test.description}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ ${test.description} blocked` :
          `❌ ${test.description} allowed unauthorized access`
      });
    }
  }

  async testHeaderManipulation() {
    console.log('📋 Testing Header Manipulation...');

    await this.loginAsOrgUser('orgA', 'salesEmployee');

    const headerTests = [
      {
        path: '/employees',
        headers: { 'X-Organization-Id': this.testOrganizations.orgB.id },
        description: 'X-Organization-Id header manipulation'
      },
      {
        path: '/deals',
        headers: { 'X-Department-Id': this.testDepartments.marketing },
        description: 'X-Department-Id header manipulation'
      },
      {
        path: '/customers',
        headers: { 'X-Tenant-Id': this.testOrganizations.orgB.id },
        description: 'X-Tenant-Id header manipulation'
      },
      {
        path: '/analytics',
        headers: {
          'X-Organization-Id': this.testOrganizations.orgA.id,
          'X-Department-Override': this.testDepartments.marketing
        },
        description: 'Department override header'
      }
    ];

    for (const test of headerTests) {
      const response = await this.makeRequest(test.path, {
        headers: test.headers
      });

      this.testResults.push({
        test: `Header Manipulation - ${test.description}`,
        passed: response.statusCode === 403 || (response.body && response.body.length === 0),
        message: response.statusCode === 403 ?
          `✅ ${test.description} blocked` :
          `❌ ${test.description} allowed unauthorized access`
      });
    }
  }

  async testAPIEndpointIsolation() {
    console.log('🔗 Testing API Endpoint Isolation...');

    await this.loginAsOrgUser('orgA', 'salesEmployee');

    const isolationTests = [
      {
        path: `/organizations/${this.testOrganizations.orgB.id}/employees`,
        description: 'Direct organization path access'
      },
      {
        path: `/departments/${this.testDepartments.marketing}/employees`,
        description: 'Direct department path access'
      },
      {
        path: `/organizations/${this.testOrganizations.orgB.id}/analytics`,
        description: 'Organization analytics path'
      },
      {
        path: `/admin/organizations/${this.testOrganizations.orgB.id}`,
        description: 'Admin organization access'
      }
    ];

    for (const test of isolationTests) {
      const response = await this.makeRequest(test.path);

      this.testResults.push({
        test: `API Endpoint Isolation - ${test.description}`,
        passed: response.statusCode === 403 || response.statusCode === 404,
        message: response.statusCode === 403 ?
          `✅ ${test.description} blocked` :
          response.statusCode === 404 ?
            `✅ ${test.description} not found (good)` :
            `❌ ${test.description} accessible`
      });
    }
  }

  async testDatabaseQueryIsolation() {
    console.log('🗄️ Testing Database Query Isolation...');

    await this.loginAsOrgUser('orgA', 'admin');

    const dbTests = [
      {
        path: '/admin/raw-query',
        method: 'POST',
        body: {
          query: `SELECT * FROM employees WHERE organization_id = '${this.testOrganizations.orgB.id}'`
        },
        description: 'Raw SQL query for other organization'
      },
      {
        path: '/admin/debug/query',
        method: 'POST',
        body: {
          table: 'employees',
          filters: { organization_id: this.testOrganizations.orgB.id }
        },
        description: 'Debug query for other organization'
      },
      {
        path: '/reports/custom',
        method: 'POST',
        body: {
          query: `
            SELECT e.name, e.email, d.name as deal_name
            FROM employees e
            JOIN deals d ON e.id = d.assigned_to
            WHERE e.organization_id IN ('${this.testOrganizations.orgA.id}', '${this.testOrganizations.orgB.id}')
          `
        },
        description: 'Custom report query spanning organizations'
      }
    ];

    for (const test of dbTests) {
      const response = await this.makeRequest(test.path, {
        method: test.method,
        body: test.body
      });

      this.testResults.push({
        test: `Database Query Isolation - ${test.description}`,
        passed: response.statusCode === 403 || response.statusCode === 404 || response.statusCode === 400,
        message: response.statusCode === 403 ?
          `✅ ${test.description} blocked` :
          response.statusCode === 404 ?
            `✅ ${test.description} endpoint not found` :
          response.statusCode === 400 ?
            `✅ ${test.description} rejected as bad request` :
            `❌ ${test.description} executed successfully (potential security risk)`
      });
    }
  }

  async testAIDataIsolation() {
    console.log('🤖 Testing AI Data Isolation...');

    await this.loginAsOrgUser('orgA', 'salesEmployee');

    const aiTests = [
      {
        path: '/ai/conversations',
        method: 'POST',
        body: {
          message: "Show me all employees from organization " + this.testOrganizations.orgB.id,
          organizationId: this.testOrganizations.orgB.id
        },
        description: 'AI conversation with other org context'
      },
      {
        path: '/ai/search',
        method: 'POST',
        body: {
          query: "employees in marketing department",
          departmentId: this.testDepartments.marketing
        },
        description: 'AI search in other department'
      },
      {
        path: '/ai/analyze',
        method: 'POST',
        body: {
          data_source: "cross_organization",
          organizations: [this.testOrganizations.orgA.id, this.testOrganizations.orgB.id]
        },
        description: 'AI analysis across organizations'
      },
      {
        path: '/ai/rag/query',
        method: 'POST',
        body: {
          question: "What are the sales numbers for all organizations?",
          context: {
            organizationId: this.testOrganizations.orgB.id
          }
        },
        description: 'RAG query with other organization context'
      }
    ];

    for (const test of aiTests) {
      const response = await this.makeRequest(test.path, {
        method: test.method,
        body: test.body
      });

      this.testResults.push({
        test: `AI Data Isolation - ${test.description}`,
        passed: response.statusCode === 403 || response.statusCode === 400 ||
                (response.body && !this.containsOrgBData(response.body)),
        message: response.statusCode === 403 ?
          `✅ ${test.description} blocked` :
          response.statusCode === 400 ?
            `✅ ${test.description} rejected` :
            `❌ AI returned data from unauthorized sources`
      });
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new DataIsolationTester();
  tester.runDataIsolationTests().catch(console.error);
}

module.exports = DataIsolationTester;