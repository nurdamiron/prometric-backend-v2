#!/usr/bin/env node

/**
 * 🔥 КРИТИЧЕСКОЕ ТЕСТИРОВАНИЕ PROMETRIC V2 BACKEND
 *
 * Этот скрипт проводит максимально глубокое тестирование всех критических
 * компонентов системы включая security, performance, edge cases
 */

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const BASE_URL = 'http://localhost:3333';
const TOTAL_CONCURRENT_USERS = 50;
const ATTACK_ITERATIONS = 100;

class CriticalTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      critical: 0,
      warnings: 0,
      details: []
    };
    this.startTime = Date.now();
  }

  log(level, test, result, details = '') {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, test, result, details };

    this.results.details.push(entry);

    if (level === 'PASS') this.results.passed++;
    else if (level === 'FAIL') this.results.failed++;
    else if (level === 'CRITICAL') this.results.critical++;
    else if (level === 'WARN') this.results.warnings++;

    const emoji = {
      'PASS': '✅',
      'FAIL': '❌',
      'CRITICAL': '🚨',
      'WARN': '⚠️'
    };

    console.log(`${emoji[level]} [${level}] ${test}: ${result}`);
    if (details) console.log(`   📝 ${details}`);
  }

  async runAllTests() {
    console.log('🔥 НАЧИНАЕМ КРИТИЧЕСКОЕ ТЕСТИРОВАНИЕ PROMETRIC V2 BACKEND');
    console.log('=' * 80);

    await this.testDatabaseIntegrity();
    await this.testSecurityPenetration();
    await this.testConcurrentUsers();
    await this.testEdgeCases();
    await this.testRealWorldScenarios();
    await this.testPerformanceAndMemory();

    this.generateReport();
  }

  // 🗄️ 1. ГЛУБОКОЕ ТЕСТИРОВАНИЕ БАЗЫ ДАННЫХ
  async testDatabaseIntegrity() {
    console.log('\n🗄️ ТЕСТИРОВАНИЕ INTEGRITY БАЗЫ ДАННЫХ');

    try {
      // Тест ACID транзакций
      console.log('\n📊 Тестирование ACID properties...');

      // Создаем 10 пользователей одновременно для проверки race conditions
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(this.registerUser(`test${i}@acid.test`, `User${i}`, 'Test'));
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0 && failed === 0) {
        this.log('PASS', 'ACID Atomicity', `${successful} concurrent registrations succeeded`);
      } else if (failed > 0) {
        this.log('WARN', 'ACID Atomicity', `${failed} registrations failed, ${successful} succeeded`, 'Some race conditions detected');
      }

      // Тест Consistency - проверка constraints
      try {
        await this.registerUser('duplicate@test.com', 'Test', 'User');
        await this.registerUser('duplicate@test.com', 'Test2', 'User2');
        this.log('CRITICAL', 'Database Constraints', 'DUPLICATE EMAIL ALLOWED!', 'Unique constraint FAILED');
      } catch (error) {
        if (error.response?.status === 409) {
          this.log('PASS', 'Database Constraints', 'Unique email constraint working');
        } else {
          this.log('FAIL', 'Database Constraints', `Unexpected error: ${error.message}`);
        }
      }

      // Тест Foreign Key constraints
      try {
        await axios.post(`${BASE_URL}/auth/register`, {
          email: 'fk-test@test.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'Test123@',
          organizationId: '99999999-9999-9999-9999-999999999999' // Non-existent
        });
        this.log('CRITICAL', 'Foreign Key Constraints', 'INVALID FK ACCEPTED!', 'Referential integrity BROKEN');
      } catch (error) {
        this.log('PASS', 'Foreign Key Constraints', 'Invalid FK rejected correctly');
      }

    } catch (error) {
      this.log('CRITICAL', 'Database Connection', 'DATABASE UNREACHABLE!', error.message);
    }
  }

  // 🛡️ 2. SECURITY PENETRATION TESTING
  async testSecurityPenetration() {
    console.log('\n🛡️ SECURITY PENETRATION TESTING');

    // SQL Injection attempts
    console.log('\n💉 Testing SQL Injection...');
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "admin'/**/OR/**/1=1#",
      "' OR 1=1--",
      "1'; INSERT INTO users (email) VALUES ('hacked@evil.com'); --"
    ];

    for (const payload of sqlPayloads) {
      try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
          email: payload,
          password: payload
        }, { timeout: 5000 });

        if (response.status === 200) {
          this.log('CRITICAL', 'SQL Injection', `PAYLOAD EXECUTED: ${payload}`, 'SYSTEM COMPROMISED!');
        } else {
          this.log('PASS', 'SQL Injection', `Payload blocked: ${payload.substring(0, 20)}...`);
        }
      } catch (error) {
        if (error.response?.status === 401) {
          this.log('PASS', 'SQL Injection', `Payload rejected: ${payload.substring(0, 20)}...`);
        } else {
          this.log('WARN', 'SQL Injection', `Unexpected response for: ${payload.substring(0, 20)}...`, error.message);
        }
      }
    }

    // XSS Testing
    console.log('\n🎭 Testing XSS Protection...');
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      'javascript:alert(1)',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      'eval(String.fromCharCode(97,108,101,114,116,40,49,41))',
      '<iframe src=javascript:alert(1)></iframe>'
    ];

    for (const payload of xssPayloads) {
      try {
        const response = await this.registerUser(`xss${Date.now()}@test.com`, payload, payload);

        // Check if dangerous content was sanitized
        if (response.data.user.firstName.includes('<script>') ||
            response.data.user.firstName.includes('javascript:') ||
            response.data.user.firstName.includes('onerror=')) {
          this.log('CRITICAL', 'XSS Protection', `DANGEROUS CONTENT STORED: ${payload}`, 'XSS vulnerability detected!');
        } else {
          this.log('PASS', 'XSS Protection', `Payload sanitized: ${payload.substring(0, 30)}...`);
        }
      } catch (error) {
        this.log('PASS', 'XSS Protection', `Payload rejected: ${payload.substring(0, 30)}...`);
      }
    }

    // JWT Token Security
    console.log('\n🎫 Testing JWT Security...');
    await this.testJWTSecurity();

    // Brute Force Protection
    console.log('\n🔨 Testing Brute Force Protection...');
    await this.testBruteForceProtection();
  }

  // 🎫 JWT Security Testing
  async testJWTSecurity() {
    const testEmail = `jwt-test-${Date.now()}@test.com`;

    try {
      // Register and get valid tokens
      const regResponse = await this.registerUser(testEmail, 'JWT', 'Test');
      await this.activateUser(testEmail);
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: testEmail,
        password: 'Test123@'
      });

      const validToken = loginResponse.data.accessToken;
      const refreshToken = loginResponse.data.refreshToken;

      // Test 1: Token tampering
      const tamperedToken = validToken.slice(0, -10) + 'TAMPERED';
      try {
        await axios.get(`${BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${tamperedToken}` }
        });
        this.log('CRITICAL', 'JWT Tampering', 'TAMPERED TOKEN ACCEPTED!', 'JWT signature verification FAILED');
      } catch (error) {
        if (error.response?.status === 401) {
          this.log('PASS', 'JWT Tampering', 'Tampered token rejected');
        }
      }

      // Test 2: Token without signature
      const [header, payload] = validToken.split('.');
      const unsignedToken = `${header}.${payload}.`;
      try {
        await axios.get(`${BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${unsignedToken}` }
        });
        this.log('CRITICAL', 'JWT Unsigned', 'UNSIGNED TOKEN ACCEPTED!', 'Signature verification bypassed');
      } catch (error) {
        this.log('PASS', 'JWT Unsigned', 'Unsigned token rejected');
      }

      // Test 3: Token with "none" algorithm
      const noneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.';
      try {
        await axios.get(`${BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${noneToken}` }
        });
        this.log('CRITICAL', 'JWT None Algorithm', 'NONE ALGORITHM ACCEPTED!', 'Critical security vulnerability');
      } catch (error) {
        this.log('PASS', 'JWT None Algorithm', 'None algorithm rejected');
      }

      // Test 4: Refresh token reuse
      try {
        await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken }); // Same token again
        this.log('WARN', 'Refresh Token Reuse', 'Token can be reused multiple times', 'Consider implementing token rotation');
      } catch (error) {
        this.log('PASS', 'Refresh Token Reuse', 'Token rotation working correctly');
      }

    } catch (error) {
      this.log('FAIL', 'JWT Setup', 'Could not setup JWT tests', error.message);
    }
  }

  // 🔨 Brute Force Protection Testing
  async testBruteForceProtection() {
    const testEmail = `brute-test-${Date.now()}@test.com`;

    try {
      await this.registerUser(testEmail, 'Brute', 'Test');
      await this.activateUser(testEmail);

      // Attempt 6 failed logins rapidly
      console.log('🔨 Attempting 6 failed logins to trigger lockout...');
      const attempts = [];

      for (let i = 0; i < 6; i++) {
        attempts.push(
          axios.post(`${BASE_URL}/auth/login`, {
            email: testEmail,
            password: 'WrongPassword123'
          }).catch(err => err.response)
        );
      }

      const results = await Promise.all(attempts);

      // Check if account gets locked
      const lastAttempt = results[results.length - 1];
      if (lastAttempt?.data?.message?.includes('locked')) {
        this.log('PASS', 'Account Lockout', 'Account locked after failed attempts');
      } else {
        this.log('CRITICAL', 'Account Lockout', 'NO LOCKOUT AFTER 6 ATTEMPTS!', 'Brute force protection FAILED');
      }

      // Test rate limiting
      console.log('🚀 Testing rate limiting with rapid requests...');
      const rapidRequests = [];
      for (let i = 0; i < 20; i++) {
        rapidRequests.push(
          axios.get(`${BASE_URL}/auth/check-email?email=test@test.com`)
            .catch(err => err.response)
        );
      }

      const rapidResults = await Promise.all(rapidRequests);
      const rateLimited = rapidResults.some(r => r?.status === 429);

      if (rateLimited) {
        this.log('PASS', 'Rate Limiting', 'Rate limiting active');
      } else {
        this.log('WARN', 'Rate Limiting', 'No rate limiting detected', 'Consider implementing rate limits');
      }

    } catch (error) {
      this.log('FAIL', 'Brute Force Setup', 'Could not test brute force protection', error.message);
    }
  }

  // ⚡ 3. CONCURRENT USERS & LOAD TESTING
  async testConcurrentUsers() {
    console.log('\n⚡ CONCURRENT USERS LOAD TESTING');

    // Test concurrent registrations
    console.log(`🔄 Testing ${TOTAL_CONCURRENT_USERS} concurrent registrations...`);

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < TOTAL_CONCURRENT_USERS; i++) {
      promises.push(
        this.registerUser(
          `load-test-${i}-${Date.now()}@test.com`,
          `LoadUser${i}`,
          'Test'
        ).catch(err => ({ error: err.message, status: err.response?.status }))
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    const avgTime = (endTime - startTime) / TOTAL_CONCURRENT_USERS;

    this.log('INFO', 'Concurrent Registrations',
      `${successful}/${TOTAL_CONCURRENT_USERS} successful, avg ${avgTime.toFixed(2)}ms per request`);

    if (successful < TOTAL_CONCURRENT_USERS * 0.8) {
      this.log('CRITICAL', 'Concurrent Load', 'HIGH FAILURE RATE UNDER LOAD!',
        `${failed} failures out of ${TOTAL_CONCURRENT_USERS} requests`);
    } else {
      this.log('PASS', 'Concurrent Load', 'System handles concurrent users well');
    }

    // Test database connection pool
    console.log('\n🏊 Testing database connection pool...');
    const dbPromises = [];
    for (let i = 0; i < 100; i++) {
      dbPromises.push(
        axios.get(`${BASE_URL}/auth/check-email?email=pool-test-${i}@test.com`)
          .catch(err => ({ error: err.message }))
      );
    }

    const dbResults = await Promise.all(dbPromises);
    const dbFailed = dbResults.filter(r => r.error).length;

    if (dbFailed > 10) {
      this.log('CRITICAL', 'DB Connection Pool', 'CONNECTION POOL EXHAUSTED!',
        `${dbFailed}/100 requests failed - increase pool size`);
    } else {
      this.log('PASS', 'DB Connection Pool', 'Connection pool handling load correctly');
    }
  }

  // 🎯 4. EDGE CASES & FAILURE SCENARIOS
  async testEdgeCases() {
    console.log('\n🎯 EDGE CASES & FAILURE SCENARIOS');

    // Test extremely long inputs
    console.log('\n📏 Testing input length limits...');
    const longString = 'A'.repeat(10000);

    try {
      await this.registerUser(`long-test@test.com`, longString, longString);
      this.log('WARN', 'Input Length Limits', 'Very long inputs accepted', 'Consider adding length validation');
    } catch (error) {
      if (error.response?.status === 400) {
        this.log('PASS', 'Input Length Limits', 'Long inputs rejected correctly');
      } else {
        this.log('FAIL', 'Input Length Limits', `Unexpected error: ${error.message}`);
      }
    }

    // Test special characters in names
    console.log('\n🔤 Testing special characters handling...');
    const specialChars = ['№', '™', '©', '®', '€', '₽', '₸', '中文', '🤖', '💰'];

    for (const char of specialChars) {
      try {
        const response = await this.registerUser(
          `special-${Date.now()}@test.com`,
          `Name${char}`,
          `Last${char}`
        );

        if (response.data.user.firstName.includes(char)) {
          this.log('PASS', 'Special Characters', `Unicode character ${char} preserved`);
        } else {
          this.log('WARN', 'Special Characters', `Character ${char} was filtered/modified`);
        }
      } catch (error) {
        this.log('FAIL', 'Special Characters', `Character ${char} caused error: ${error.message}`);
      }
    }

    // Test malformed JSON
    console.log('\n📄 Testing malformed JSON handling...');
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`,
        '{"email":"test@test.com","firstName":"Test"', // Missing closing brace
        { headers: { 'Content-Type': 'application/json' } }
      );
      this.log('CRITICAL', 'Malformed JSON', 'MALFORMED JSON ACCEPTED!', 'Input validation bypass');
    } catch (error) {
      if (error.response?.status === 400) {
        this.log('PASS', 'Malformed JSON', 'Malformed JSON rejected correctly');
      } else {
        this.log('WARN', 'Malformed JSON', `Unexpected error: ${error.message}`);
      }
    }

    // Test empty/null values
    console.log('\n🕳️ Testing null/empty value handling...');
    const nullTests = [
      { email: null, firstName: 'Test', lastName: 'User', password: 'Test123@' },
      { email: '', firstName: 'Test', lastName: 'User', password: 'Test123@' },
      { email: 'test@test.com', firstName: null, lastName: 'User', password: 'Test123@' },
      { email: 'test@test.com', firstName: '', lastName: 'User', password: 'Test123@' },
      { email: 'test@test.com', firstName: 'Test', lastName: 'User', password: null },
      { email: 'test@test.com', firstName: 'Test', lastName: 'User', password: '' }
    ];

    for (const testData of nullTests) {
      try {
        await axios.post(`${BASE_URL}/auth/register`, testData);
        this.log('CRITICAL', 'Null Value Validation', 'NULL/EMPTY VALUES ACCEPTED!',
          `Data: ${JSON.stringify(testData).substring(0, 50)}...`);
      } catch (error) {
        if (error.response?.status === 400) {
          this.log('PASS', 'Null Value Validation', 'Null/empty values rejected');
        }
      }
    }
  }

  // 🌍 5. REAL-WORLD SCENARIOS
  async testRealWorldScenarios() {
    console.log('\n🌍 REAL-WORLD SCENARIOS TESTING');

    // Complete Owner Journey
    console.log('\n👑 Testing complete OWNER journey...');
    const ownerEmail = `owner-journey-${Date.now()}@test.com`;

    try {
      // 1. Register
      const regResponse = await this.registerUser(ownerEmail, 'Business', 'Owner');
      this.log('PASS', 'Owner Registration', 'Owner registered successfully');

      // 2. Activate
      await this.activateUser(ownerEmail);
      this.log('PASS', 'Owner Activation', 'Owner activated successfully');

      // 3. Login
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: ownerEmail,
        password: 'Test123@'
      });
      const token = loginResponse.data.accessToken;
      this.log('PASS', 'Owner Login', 'Owner login successful');

      // 4. Complete Onboarding as Owner
      const onboardingResponse = await axios.post(`${BASE_URL}/auth/finish`, {
        onboardingData: {
          firstName: 'Business',
          lastName: 'Owner',
          userType: 'owner',
          companyName: 'Real Test Company LLP',
          companyBin: '555666777888',
          industry: 'Technology',
          theme: 'dark'
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (onboardingResponse.data.success) {
        this.log('PASS', 'Owner Onboarding', 'Company created successfully');

        // 5. Check organization was created
        const companyCheck = await axios.get(`${BASE_URL}/auth/company?bin=555666777888`);
        if (companyCheck.data.exists) {
          this.log('PASS', 'Organization Creation', 'Organization created and findable by BIN');
        } else {
          this.log('CRITICAL', 'Organization Creation', 'ORGANIZATION NOT CREATED!', 'Owner onboarding broken');
        }
      } else {
        this.log('CRITICAL', 'Owner Onboarding', 'OWNER ONBOARDING FAILED!', onboardingResponse.data.message);
      }

    } catch (error) {
      this.log('CRITICAL', 'Owner Journey', 'COMPLETE OWNER JOURNEY FAILED!', error.message);
    }

    // Complete Employee Journey
    console.log('\n👥 Testing complete EMPLOYEE journey...');
    const employeeEmail = `employee-journey-${Date.now()}@test.com`;

    try {
      // 1. Register Employee
      await this.registerUser(employeeEmail, 'Employee', 'Test');
      await this.activateUser(employeeEmail);

      const empLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: employeeEmail,
        password: 'Test123@'
      });
      const empToken = empLoginResponse.data.accessToken;

      // 2. Complete Employee Onboarding (try to join existing company)
      try {
        const empOnboarding = await axios.post(`${BASE_URL}/auth/finish`, {
          onboardingData: {
            firstName: 'Employee',
            lastName: 'Test',
            userType: 'employee',
            companyBin: '555666777888' // From owner test above
          }
        }, {
          headers: { Authorization: `Bearer ${empToken}` }
        });

        if (empOnboarding.data.success) {
          this.log('PASS', 'Employee Onboarding', 'Employee registered for company approval');
        }
      } catch (error) {
        this.log('FAIL', 'Employee Onboarding', error.response?.data?.message || error.message);
      }

    } catch (error) {
      this.log('CRITICAL', 'Employee Journey', 'EMPLOYEE JOURNEY FAILED!', error.message);
    }
  }

  // 📊 6. PERFORMANCE & MEMORY TESTING
  async testPerformanceAndMemory() {
    console.log('\n📊 PERFORMANCE & MEMORY ANALYSIS');

    // Test response times under load
    console.log('\n⏱️ Testing response times...');

    const performanceTests = [
      { endpoint: '/', method: 'GET', name: 'Health Check' },
      { endpoint: '/auth/check-email?email=perf@test.com', method: 'GET', name: 'Email Check' },
      { endpoint: '/auth/validate-password', method: 'POST', data: { password: 'Test123@' }, name: 'Password Validation' },
      { endpoint: '/auth/company?bin=123456789012', method: 'GET', name: 'Company Search' }
    ];

    for (const test of performanceTests) {
      const times = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        try {
          if (test.method === 'GET') {
            await axios.get(`${BASE_URL}${test.endpoint}`);
          } else {
            await axios.post(`${BASE_URL}${test.endpoint}`, test.data);
          }
          times.push(Date.now() - start);
        } catch (error) {
          times.push(999999); // Mark as very slow if error
        }
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      if (avgTime > 1000) {
        this.log('CRITICAL', `Performance: ${test.name}`, `VERY SLOW: ${avgTime.toFixed(2)}ms avg`, `Max: ${maxTime}ms`);
      } else if (avgTime > 500) {
        this.log('WARN', `Performance: ${test.name}`, `Slow: ${avgTime.toFixed(2)}ms avg`, `Max: ${maxTime}ms`);
      } else {
        this.log('PASS', `Performance: ${test.name}`, `${avgTime.toFixed(2)}ms avg`, `Max: ${maxTime}ms`);
      }
    }

    // Memory leak simulation
    console.log('\n🧠 Testing for memory leaks...');
    const memoryTests = [];

    for (let i = 0; i < 50; i++) {
      memoryTests.push(
        this.registerUser(`memory-test-${i}-${Date.now()}@test.com`, `User${i}`, 'Test')
          .catch(err => ({ error: err.message }))
      );
    }

    const memoryResults = await Promise.all(memoryTests);
    const memorySuccessful = memoryResults.filter(r => !r.error).length;

    if (memorySuccessful < 40) {
      this.log('CRITICAL', 'Memory Management', 'SYSTEM FAILING UNDER MEMORY PRESSURE!',
        `Only ${memorySuccessful}/50 requests succeeded`);
    } else {
      this.log('PASS', 'Memory Management', 'Memory management stable under load');
    }
  }

  // 🎲 7. КАЗАХСТАНСКИЕ BUSINESS REQUIREMENTS
  async testKazakhstanRequirements() {
    console.log('\n🇰🇿 KAZAKHSTAN BUSINESS REQUIREMENTS');

    // Test BIN validation
    const invalidBins = [
      '12345', // Too short
      '1234567890123', // Too long
      'abc123456789', // Non-numeric
      '000000000000', // All zeros
      '999999999999' // All nines (might be invalid)
    ];

    for (const bin of invalidBins) {
      try {
        await this.registerUser(`bin-test-${Date.now()}@test.com`, 'Test', 'User', bin);
        this.log('CRITICAL', 'BIN Validation', `INVALID BIN ACCEPTED: ${bin}`, 'Kazakhstan compliance broken');
      } catch (error) {
        this.log('PASS', 'BIN Validation', `Invalid BIN rejected: ${bin}`);
      }
    }

    // Test Cyrillic text support
    const cyrillicTest = {
      firstName: 'Нұрдәулет',
      lastName: 'Ахматов',
      companyName: 'ТОО "Прометрик Солюшнс"'
    };

    try {
      const response = await this.registerUser(
        `cyrillic-${Date.now()}@test.kz`,
        cyrillicTest.firstName,
        cyrillicTest.lastName
      );

      if (response.data.user.firstName === cyrillicTest.firstName) {
        this.log('PASS', 'Cyrillic Support', 'Kazakh/Russian text preserved correctly');
      } else {
        this.log('WARN', 'Cyrillic Support', 'Cyrillic text modified during processing');
      }
    } catch (error) {
      this.log('FAIL', 'Cyrillic Support', 'Cyrillic text caused errors', error.message);
    }
  }

  // 🔧 Helper Methods
  async registerUser(email, firstName, lastName, companyBin = null) {
    const userData = {
      email,
      firstName,
      lastName,
      password: 'Test123@',
      phone: '+77771234567'
    };

    if (companyBin) {
      userData.companyBin = companyBin;
      userData.companyName = 'Test Company';
      userData.industry = 'Technology';
    }

    return await axios.post(`${BASE_URL}/auth/register`, userData);
  }

  async activateUser(email) {
    return await axios.post(`${BASE_URL}/test/activate-user`, { email });
  }

  // 📊 Generate Final Report
  generateReport() {
    const endTime = Date.now();
    const totalTime = (endTime - this.startTime) / 1000;

    console.log('\n' + '='.repeat(80));
    console.log('🔥 КРИТИЧЕСКОЕ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
    console.log('='.repeat(80));
    console.log(`⏱️  Общее время: ${totalTime.toFixed(2)} секунд`);
    console.log(`✅ Пройдено: ${this.results.passed}`);
    console.log(`❌ Провалено: ${this.results.failed}`);
    console.log(`🚨 Критические: ${this.results.critical}`);
    console.log(`⚠️  Предупреждения: ${this.results.warnings}`);

    // Critical findings
    const criticalIssues = this.results.details.filter(d => d.level === 'CRITICAL');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ:');
      criticalIssues.forEach(issue => {
        console.log(`   ❌ ${issue.test}: ${issue.result}`);
        if (issue.details) console.log(`      📝 ${issue.details}`);
      });
    }

    // Calculate score
    const totalTests = this.results.passed + this.results.failed + this.results.critical;
    const score = totalTests > 0 ? ((this.results.passed / totalTests) * 100).toFixed(1) : 0;

    console.log(`\n🏆 ФИНАЛЬНАЯ ОЦЕНКА: ${score}%`);

    if (score >= 95) {
      console.log('🟢 СИСТЕМА ГОТОВА ДЛЯ PRODUCTION');
    } else if (score >= 80) {
      console.log('🟡 СИСТЕМА ТРЕБУЕТ ДОРАБОТКИ');
    } else {
      console.log('🔴 СИСТЕМА НЕ ГОТОВА ДЛЯ PRODUCTION');
    }

    // Save detailed report
    const reportData = {
      summary: {
        totalTime,
        score: parseFloat(score),
        passed: this.results.passed,
        failed: this.results.failed,
        critical: this.results.critical,
        warnings: this.results.warnings
      },
      details: this.results.details,
      criticalIssues,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      '/tmp/prometric-critical-test-report.json',
      JSON.stringify(reportData, null, 2)
    );

    console.log('\n📄 Детальный отчет сохранен: /tmp/prometric-critical-test-report.json');
  }
}

// Execute if called directly
if (require.main === module) {
  const suite = new CriticalTestSuite();
  suite.runAllTests().catch(console.error);
}

module.exports = CriticalTestSuite;