#!/usr/bin/env node

/**
 * 🔐 COMPREHENSIVE AUTH FLOW TEST
 * Tests the complete authentication flow with HttpOnly cookies
 */

const axios = require('axios');
const https = require('https');

// Configuration
const BASE_URL = 'http://localhost:3333';
const TEST_EMAIL = `test-${Date.now()}@prometric.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'User';

// Create axios instance with cookie support
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Enable HttpOnly cookies
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store cookies manually for debugging
let storedCookies = '';

// Test results
const results = {
  registration: null,
  emailVerification: null,
  login: null,
  profile: null,
  logout: null,
  errors: []
};

// Utility functions
const log = (step, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${step}: ${message}`);
  if (data) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
};

// Extract and store cookies from response
const extractCookies = (response) => {
  const setCookieHeaders = response.headers['set-cookie'];
  if (setCookieHeaders) {
    storedCookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
    log('COOKIES', `🍪 Stored cookies: ${storedCookies}`);
  }
};

// Add cookies to request
const addCookiesToRequest = (config) => {
  if (storedCookies) {
    config.headers = config.headers || {};
    config.headers['Cookie'] = storedCookies;
    log('COOKIES', `🍪 Adding cookies to request: ${storedCookies}`);
  }
  return config;
};

const logError = (step, error) => {
  const errorMsg = error.response?.data || error.message;
  log(step, `❌ ERROR: ${errorMsg}`);
  results.errors.push({ step, error: errorMsg });
};

// Test 1: Registration
async function testRegistration() {
  log('REGISTRATION', '🚀 Starting registration test...');
  
  try {
    const response = await api.post('/auth/register', {
      email: TEST_EMAIL,
      firstName: TEST_FIRST_NAME,
      lastName: TEST_LAST_NAME,
      password: TEST_PASSWORD,
      phone: '+77001234567',
      companyBin: '123456789012',
      companyName: 'Test Company',
      industry: 'Technology'
    });

    log('REGISTRATION', '✅ Registration successful', response.data);
    results.registration = response.data;
    
    // Verify no tokens in response (should be in HttpOnly cookies)
    if (response.data.accessToken || response.data.refreshToken) {
      log('REGISTRATION', '⚠️ WARNING: Tokens found in response body (should be in HttpOnly cookies)');
    }
    
    return response.data;
  } catch (error) {
    logError('REGISTRATION', error);
    throw error;
  }
}

// Test 2: Get verification code (for testing)
async function getVerificationCode() {
  log('VERIFICATION_CODE', '🔍 Getting verification code for testing...');
  
  try {
    const response = await api.get(`/auth/test/verification-code/${TEST_EMAIL}`);
    log('VERIFICATION_CODE', '✅ Verification code retrieved', response.data);
    return response.data.verificationCode;
  } catch (error) {
    logError('VERIFICATION_CODE', error);
    throw error;
  }
}

// Test 3: Email verification with HttpOnly cookies
async function testEmailVerification(verificationCode) {
  log('EMAIL_VERIFICATION', '📧 Testing email verification with HttpOnly cookies...');
  
  try {
    const response = await api.post('/auth/verify-code', {
      email: TEST_EMAIL,
      code: verificationCode
    });

    log('EMAIL_VERIFICATION', '✅ Email verification successful', response.data);
    results.emailVerification = response.data;
    
    // Extract and store cookies
    extractCookies(response);
    
    return response.data;
  } catch (error) {
    logError('EMAIL_VERIFICATION', error);
    throw error;
  }
}

// Test 4: Login with HttpOnly cookies
async function testLogin() {
  log('LOGIN', '🔑 Testing login with HttpOnly cookies...');
  
  try {
    const response = await api.post('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    log('LOGIN', '✅ Login successful', response.data);
    results.login = response.data;
    
    // Extract and store cookies
    extractCookies(response);
    
    return response.data;
  } catch (error) {
    logError('LOGIN', error);
    throw error;
  }
}

// Test 5: Get profile (should use HttpOnly cookies)
async function testProfile() {
  log('PROFILE', '👤 Testing profile access with HttpOnly cookies...');
  
  try {
    const config = addCookiesToRequest({});
    const response = await api.get('/auth/me', config);
    log('PROFILE', '✅ Profile access successful', response.data);
    results.profile = response.data;
    return response.data;
  } catch (error) {
    log('PROFILE', `❌ Profile access failed: ${error.response?.status} ${error.response?.statusText}`);
    if (error.response?.data) {
      log('PROFILE', 'Error details:', error.response.data);
    }
    results.errors.push({ step: 'PROFILE', error: error.response?.data || error.message });
    return null;
  }
}

// Test 6: Logout (should clear HttpOnly cookies)
async function testLogout() {
  log('LOGOUT', '🚪 Testing logout with HttpOnly cookies...');
  
  try {
    const config = addCookiesToRequest({});
    const response = await api.post('/auth/logout', {}, config);
    log('LOGOUT', '✅ Logout successful', response.data);
    results.logout = response.data;
    
    // Check if cookies are cleared
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      log('LOGOUT', '🍪 Cookies cleared:', cookies);
    }
    
    return response.data;
  } catch (error) {
    log('LOGOUT', `❌ Logout failed: ${error.response?.status} ${error.response?.statusText}`);
    if (error.response?.data) {
      log('LOGOUT', 'Error details:', error.response.data);
    }
    results.errors.push({ step: 'LOGOUT', error: error.response?.data || error.message });
    return null;
  }
}

// Test 7: Verify session is cleared
async function testSessionCleared() {
  log('SESSION_CHECK', '🔍 Verifying session is cleared...');
  
  try {
    const response = await api.get('/auth/me');
    log('SESSION_CHECK', '❌ ERROR: Session should be cleared but profile accessible');
    results.errors.push({ step: 'SESSION_CHECK', error: 'Session not cleared properly' });
  } catch (error) {
    if (error.response?.status === 401) {
      log('SESSION_CHECK', '✅ Session properly cleared (401 Unauthorized)');
    } else {
      logError('SESSION_CHECK', error);
    }
  }
}

// Main test runner
async function runAuthFlowTest() {
  console.log('🚀 STARTING COMPREHENSIVE AUTH FLOW TEST');
  console.log('=' .repeat(60));
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log(`Test Password: ${TEST_PASSWORD}`);
  console.log('=' .repeat(60));

  try {
    // Step 1: Registration
    await testRegistration();
    
    // Step 2: Get verification code
    const verificationCode = await getVerificationCode();
    
    // Step 3: Email verification
    await testEmailVerification(verificationCode);
    
    // Step 4: Login
    await testLogin();
    
    // Step 5: Profile access
    await testProfile();
    
    // Step 6: Logout
    await testLogout();
    
    // Step 7: Verify session cleared
    await testSessionCleared();
    
    // Summary
    console.log('\n🎉 AUTH FLOW TEST COMPLETED');
    console.log('=' .repeat(60));
    console.log('✅ Registration:', results.registration ? 'PASS' : 'FAIL');
    console.log('✅ Email Verification:', results.emailVerification ? 'PASS' : 'FAIL');
    console.log('✅ Login:', results.login ? 'PASS' : 'FAIL');
    console.log('✅ Profile Access:', results.profile ? 'PASS' : 'FAIL');
    console.log('✅ Logout:', results.logout ? 'PASS' : 'FAIL');
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach(error => {
        console.log(`  - ${error.step}: ${error.error}`);
      });
    } else {
      console.log('\n🎉 ALL TESTS PASSED! HttpOnly cookies working perfectly!');
    }
    
  } catch (error) {
    console.error('\n💥 TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runAuthFlowTest().catch(console.error);
}

module.exports = { runAuthFlowTest, results };