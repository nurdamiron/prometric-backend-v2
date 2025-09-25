#!/usr/bin/env node

/**
 * Comprehensive test for DDD authentication/registration/onboarding flow
 * Tests the complete user journey from registration to onboarding completion
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const API_BASE = process.env.API_URL || 'http://localhost:3333';

// Test data
const testUser = {
  email: `test.${Date.now()}@example.com`,
  firstName: 'Test',
  lastName: 'User',
  password: 'testpass123!',
  phone: '+77771234567',
  companyBin: '123456789012',
  companyName: 'Test Company LTD',
  industry: 'technology'
};

let userTokens = {};
let verificationCode = null; // Will be fetched from database

async function testRegistration() {
  console.log('🔄 Step 1: Testing User Registration...');

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Registration successful');
      console.log('📧 User created with status:', result.user?.status);
      console.log('📝 Onboarding step:', result.user?.onboardingStep);
      return { success: true, data: result };
    } else {
      console.log('❌ Registration failed:', result.message);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Registration error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEmailVerification() {
  console.log('\n🔄 Step 2: Testing Email Verification...');

  try {
    // First, send verification code
    const sendResponse = await fetch(`${API_BASE}/auth/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testUser.email,
        language: 'en'
      })
    });

    const sendResult = await sendResponse.json();
    console.log('📧 Send code result:', sendResult.message);

    // Get real verification code from test endpoint
    const codeResponse = await fetch(`${API_BASE}/auth/test/verification-code/${encodeURIComponent(testUser.email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const codeResult = await codeResponse.json();
    if (codeResult.success && codeResult.verificationCode) {
      verificationCode = codeResult.verificationCode;
      console.log('🔍 Retrieved verification code from database');
    } else {
      console.log('⚠️  Could not retrieve verification code, using mock');
      verificationCode = '123456';
    }

    // Verify email with real code
    const verifyResponse = await fetch(`${API_BASE}/auth/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testUser.email,
        code: verificationCode
      })
    });

    const verifyResult = await verifyResponse.json();

    if (verifyResponse.ok && verifyResult.success) {
      console.log('✅ Email verification successful');
      console.log('🔑 Access token received:', verifyResult.accessToken ? 'YES' : 'NO');
      console.log('🔄 Refresh token received:', verifyResult.refreshToken ? 'YES' : 'NO');

      userTokens = {
        accessToken: verifyResult.accessToken,
        refreshToken: verifyResult.refreshToken
      };

      return { success: true, data: verifyResult };
    } else {
      console.log('❌ Email verification failed:', verifyResult.message);
      return { success: false, error: verifyResult };
    }
  } catch (error) {
    console.log('❌ Email verification error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testUserProfile() {
  console.log('\n🔄 Step 3: Testing User Profile Access...');

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Profile access successful');
      console.log('👤 User ID:', result.user?.id);
      console.log('📧 Email:', result.user?.email);
      console.log('📊 Status:', result.user?.status);
      console.log('🎯 Onboarding step:', result.user?.onboardingStep);
      return { success: true, data: result };
    } else {
      console.log('❌ Profile access failed:', result.message);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Profile access error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testOnboardingProgress() {
  console.log('\n🔄 Step 4: Testing Onboarding Progress...');

  try {
    const progressData = {
      onboardingStep: 'personal',
      onboardingData: {
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        phone: testUser.phone,
        theme: 'light'
      }
    };

    const response = await fetch(`${API_BASE}/auth/progress`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(progressData)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Onboarding progress saved');
      console.log('📈 Current step:', result.onboardingStep);
      return { success: true, data: result };
    } else {
      console.log('❌ Onboarding progress failed:', result.message);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Onboarding progress error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testCompanySearch() {
  console.log('\n🔄 Step 5: Testing Company Search...');

  try {
    const response = await fetch(`${API_BASE}/auth/company?bin=${testUser.companyBin}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Company search successful');
      console.log('🏢 Company exists:', result.exists);
      if (result.exists) {
        console.log('🏢 Company name:', result.company?.name);
        console.log('👤 Owner:', result.company?.owner?.firstName, result.company?.owner?.lastName);
      }
      return { success: true, data: result };
    } else {
      console.log('❌ Company search failed');
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Company search error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testOnboardingCompletion() {
  console.log('\n🔄 Step 6: Testing Onboarding Completion...');

  try {
    const onboardingData = {
      onboardingData: {
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        phone: testUser.phone,
        userType: 'owner',
        companyBin: testUser.companyBin,
        companyName: testUser.companyName,
        industry: testUser.industry,
        theme: 'light',
        plan: 'basic',
        features: ['ai-assistant', 'crm'],
        aiConfig: {
          assistantName: 'TestAI',
          personality: 'professional',
          expertise: ['sales', 'support']
        }
      }
    };

    const response = await fetch(`${API_BASE}/auth/finish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(onboardingData)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Onboarding completion successful');
      console.log('👤 Final user role:', result.user?.role);
      console.log('📊 Final status:', result.user?.status);
      console.log('🏢 Organization ID:', result.user?.organizationId);
      console.log('🎯 Onboarding step:', result.user?.onboardingStep);
      return { success: true, data: result };
    } else {
      console.log('❌ Onboarding completion failed:', result.message);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Onboarding completion error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testTokenRefresh() {
  console.log('\n🔄 Step 7: Testing Token Refresh...');

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: userTokens.refreshToken
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Token refresh successful');
      console.log('🔑 New access token received:', result.accessToken ? 'YES' : 'NO');
      console.log('🔄 New refresh token received:', result.refreshToken ? 'YES' : 'NO');

      // Update tokens
      userTokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      };

      return { success: true, data: result };
    } else {
      console.log('❌ Token refresh failed:', result.message);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Token refresh error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testCleanupPreview() {
  console.log('\n🔄 Step 8: Testing Cleanup Preview...');

  try {
    const response = await fetch(`${API_BASE}/auth/admin/cleanup-preview?timeoutSeconds=30`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Cleanup preview successful');
      console.log('📊 Users to cleanup:', result.usersToCleanup?.length || 0);
      console.log('⏰ Timeout used:', result.timeoutUsed, 'seconds');
      return { success: true, data: result };
    } else {
      console.log('❌ Cleanup preview failed');
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Cleanup preview error:', error.message);
    return { success: false, error: error.message };
  }
}

async function testLogout() {
  console.log('\n🔄 Step 9: Testing Logout...');

  try {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userTokens.accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Logout successful');
      console.log('📝 Message:', result.message);
      return { success: true, data: result };
    } else {
      console.log('❌ Logout failed:', result.message);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ Logout error:', error.message);
    return { success: false, error: error.message };
  }
}

async function runCompleteAuthTest() {
  console.log('🎯 DDD AUTHENTICATION FLOW - COMPREHENSIVE TEST');
  console.log('===============================================');
  console.log(`📧 Test email: ${testUser.email}`);
  console.log(`🏢 Test company: ${testUser.companyName} (${testUser.companyBin})\n`);

  const results = {
    registration: null,
    emailVerification: null,
    profileAccess: null,
    onboardingProgress: null,
    companySearch: null,
    onboardingCompletion: null,
    tokenRefresh: null,
    cleanupPreview: null,
    logout: null
  };

  try {
    // Step 1: Registration
    results.registration = await testRegistration();
    if (!results.registration.success) {
      throw new Error('Registration failed');
    }

    // Step 2: Email Verification (with mock code)
    results.emailVerification = await testEmailVerification();
    if (!results.emailVerification.success) {
      throw new Error('Email verification failed');
    }

    // Step 3: Profile Access
    results.profileAccess = await testUserProfile();
    if (!results.profileAccess.success) {
      throw new Error('Profile access failed');
    }

    // Step 4: Onboarding Progress
    results.onboardingProgress = await testOnboardingProgress();
    if (!results.onboardingProgress.success) {
      console.log('⚠️  Onboarding progress failed, continuing...');
    }

    // Step 5: Company Search
    results.companySearch = await testCompanySearch();
    if (!results.companySearch.success) {
      console.log('⚠️  Company search failed, continuing...');
    }

    // Step 6: Onboarding Completion
    results.onboardingCompletion = await testOnboardingCompletion();
    if (!results.onboardingCompletion.success) {
      console.log('⚠️  Onboarding completion failed, continuing...');
    }

    // Step 7: Token Refresh
    results.tokenRefresh = await testTokenRefresh();
    if (!results.tokenRefresh.success) {
      console.log('⚠️  Token refresh failed, continuing...');
    }

    // Step 8: Cleanup Preview (admin endpoint)
    results.cleanupPreview = await testCleanupPreview();
    if (!results.cleanupPreview.success) {
      console.log('⚠️  Cleanup preview failed, continuing...');
    }

    // Step 9: Logout
    results.logout = await testLogout();
    if (!results.logout.success) {
      console.log('⚠️  Logout failed, continuing...');
    }

  } catch (error) {
    console.log(`\n❌ Test suite failed at: ${error.message}`);
  }

  // Summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');

  const testResults = [
    { name: 'Registration', result: results.registration },
    { name: 'Email Verification', result: results.emailVerification },
    { name: 'Profile Access', result: results.profileAccess },
    { name: 'Onboarding Progress', result: results.onboardingProgress },
    { name: 'Company Search', result: results.companySearch },
    { name: 'Onboarding Completion', result: results.onboardingCompletion },
    { name: 'Token Refresh', result: results.tokenRefresh },
    { name: 'Cleanup Preview', result: results.cleanupPreview },
    { name: 'Logout', result: results.logout }
  ];

  testResults.forEach(test => {
    const status = test.result?.success ? '✅' : '❌';
    const name = test.name.padEnd(20);
    console.log(`${status} ${name} ${test.result?.success ? 'PASSED' : 'FAILED'}`);
  });

  const passedTests = testResults.filter(test => test.result?.success).length;
  const totalTests = testResults.length;

  console.log(`\n📈 Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED - DDD Authentication flow working perfectly!');
  } else {
    console.log('⚠️  Some tests failed - check logs above for details');
  }

  return {
    passed: passedTests,
    total: totalTests,
    success: passedTests === totalTests,
    results
  };
}

// Additional helper tests
async function testPasswordValidation() {
  console.log('\n🔄 Bonus: Testing Password Validation...');

  const passwords = [
    'weak',
    'stronger123',
    'VeryStrong123!',
    testUser.password
  ];

  for (const password of passwords) {
    try {
      const response = await fetch(`${API_BASE}/auth/validate-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password })
      });

      const result = await response.json();
      console.log(`🔒 "${password}": ${result.isValid ? 'VALID' : 'INVALID'} (score: ${result.score}/${result.maxScore})`);
    } catch (error) {
      console.log(`❌ Password validation error for "${password}":`, error.message);
    }
  }
}

async function testEmailExists() {
  console.log('\n🔄 Bonus: Testing Email Exists Check...');

  const emails = [
    testUser.email,
    'nonexistent@example.com'
  ];

  for (const email of emails) {
    try {
      const response = await fetch(`${API_BASE}/auth/check-email?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      console.log(`📧 "${email}": ${result.exists ? 'EXISTS' : 'AVAILABLE'}`);
    } catch (error) {
      console.log(`❌ Email check error for "${email}":`, error.message);
    }
  }
}

// Main execution
if (require.main === module) {
  runCompleteAuthTest()
    .then(async (summary) => {
      // Run bonus tests
      await testPasswordValidation();
      await testEmailExists();

      console.log('\n🏁 Complete DDD Authentication Test Finished!');
      console.log(`Final Score: ${summary.passed}/${summary.total} tests passed`);

      process.exit(summary.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = {
  runCompleteAuthTest,
  testRegistration,
  testEmailVerification,
  testUserProfile,
  testOnboardingProgress,
  testOnboardingCompletion,
  testTokenRefresh,
  testLogout
};