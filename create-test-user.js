#!/usr/bin/env node

// Create Complete Test User for AI Brain Testing
// This script creates a fully verified user with organization

const API_BASE = 'http://localhost:3333';

async function makeRequest(endpoint, method = 'GET', data = null, token = null) {
  const url = `${API_BASE}${endpoint}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    ...(data ? { body: JSON.stringify(data) } : {})
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    return {
      status: response.status,
      success: response.ok,
      data: result
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function createTestUser() {
  console.log('👤 Creating test user for AI Brain...\n');

  const userData = {
    email: 'aitest@prometric.kz',
    password: 'AiTest123!',
    firstName: 'AI',
    lastName: 'Tester'
  };

  console.log(`📧 Registering user: ${userData.email}`);

  const registerResult = await makeRequest('/auth/register', 'POST', userData);

  if (!registerResult.success) {
    if (registerResult.data.message?.includes('already exists')) {
      console.log('✅ User already exists, proceeding with verification...');
    } else {
      throw new Error(`Registration failed: ${JSON.stringify(registerResult.data)}`);
    }
  } else {
    console.log('✅ User registered successfully!');
  }

  return userData;
}

async function verifyUser(userData) {
  console.log('\n📧 Verifying user email...');

  // Since we can't access real verification codes, we'll use a SQL approach
  console.log('💡 Using direct database approach for verification...');

  const sqlCommands = `
-- Connect to PostgreSQL and run these commands:

-- 1. Check if user exists
SELECT id, email, status, onboarding_step, verification_code
FROM users
WHERE email = '${userData.email}';

-- 2. Force verify the user (bypass email verification for testing)
UPDATE users
SET
  status = 'active',
  onboarding_step = 'completed',
  verification_code = NULL,
  verification_expires_at = NULL,
  role = 'owner'
WHERE email = '${userData.email}';

-- 3. Create organization for the user
INSERT INTO organizations (id, name, bin, industry, address, city, phone, email, status)
VALUES (
  gen_random_uuid(),
  'Prometric Test Company',
  '123456789012',
  'Technology',
  'Алматы, ул. Абая 150',
  'Алматы',
  '+77771234567',
  'test@prometric-company.kz',
  'active'
) ON CONFLICT (bin) DO NOTHING;

-- 4. Assign user to organization
UPDATE users
SET organization_id = (
  SELECT id FROM organizations WHERE bin = '123456789012' LIMIT 1
)
WHERE email = '${userData.email}';

-- 5. Verify setup
SELECT
  u.id, u.email, u.status, u.role, u.onboarding_step,
  o.name as org_name, o.bin as org_bin
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.email = '${userData.email}';
`;

  console.log('\n📝 SQL Commands to run:');
  console.log(sqlCommands);

  return userData;
}

async function defineTestCriteria() {
  console.log('\n🎯 AI BRAIN TEST CRITERIA:\n');

  const criteria = {
    '1. Authentication & Authorization': {
      '✅ User login with JWT': 'Must return valid access_token',
      '✅ Protected endpoints': 'Must require authentication',
      '✅ Organization access': 'Must have organizationId in JWT'
    },

    '2. AI Assistant Configuration': {
      '✅ Configure personality': 'professional, friendly, analytical, creative, supportive',
      '✅ Set expertise areas': 'CRM, Sales, Analytics, etc.',
      '✅ Voice preference': 'male, female, neutral',
      '✅ Assistant naming': 'Custom assistant name'
    },

    '3. Knowledge Management & RAG': {
      '✅ Add manual content': 'Store documents in knowledge base',
      '✅ Generate embeddings': 'Vertex AI gemini-embedding-001 (768 dimensions)',
      '✅ Semantic search': 'Find relevant documents by meaning',
      '✅ Hybrid search': 'Combine semantic + keyword search',
      '✅ Multi-tenant isolation': 'Only organization\'s knowledge'
    },

    '4. AI Chat & Orchestration': {
      '✅ RAG-enhanced responses': 'AI uses knowledge base for answers',
      '✅ Context awareness': 'Remembers conversation history',
      '✅ Session management': 'Continuous conversations',
      '✅ Vertex AI integration': 'gemini-2.5-flash/pro models',
      '✅ Function calling': 'CRM actions integration',
      '✅ Source attribution': 'Shows which documents were used'
    },

    '5. Performance & Quality': {
      '✅ Response time': '< 5 seconds for 95% requests',
      '✅ Accuracy': 'Relevant answers from knowledge base',
      '✅ Multilingual': 'Russian + Kazakh support',
      '✅ Error handling': 'Graceful failures, no crashes',
      '✅ Token optimization': 'Efficient token usage'
    },

    '6. Conversation Flow': {
      '✅ Multi-turn dialog': 'AI remembers context across messages',
      '✅ Session continuity': 'Same sessionId for conversation',
      '✅ Message storage': 'All messages saved to database',
      '✅ Metadata tracking': 'Tokens, model, sources, timing'
    }
  };

  console.log('🧠 SUCCESS CRITERIA FOR AI BRAIN:');
  Object.entries(criteria).forEach(([category, tests]) => {
    console.log(`\n${category}:`);
    Object.entries(tests).forEach(([test, requirement]) => {
      console.log(`  ${test}: ${requirement}`);
    });
  });

  return criteria;
}

async function createTestPlan() {
  console.log('\n📋 TEST EXECUTION PLAN:\n');

  const testPlan = [
    '1. 🔐 USER SETUP',
    '   - Create user account',
    '   - Verify email (manual SQL)',
    '   - Create organization',
    '   - Assign user to organization',
    '',
    '2. 🤖 AI CONFIGURATION',
    '   - Configure AI Assistant personality',
    '   - Set expertise areas',
    '   - Verify configuration stored',
    '',
    '3. 📚 KNOWLEDGE BASE',
    '   - Add manual knowledge content',
    '   - Generate embeddings (Vertex AI)',
    '   - Verify embeddings stored',
    '   - Test RAG search functionality',
    '',
    '4. 💬 AI BRAIN CHAT',
    '   - Send first message (creates session)',
    '   - Verify RAG knowledge used in response',
    '   - Send follow-up message (same session)',
    '   - Verify conversation context maintained',
    '',
    '5. 📊 VALIDATION',
    '   - Check response quality',
    '   - Verify knowledge sources',
    '   - Validate conversation storage',
    '   - Measure performance metrics'
  ];

  testPlan.forEach(step => console.log(step));

  return testPlan;
}

async function main() {
  try {
    console.log('🧠 AI BRAIN COMPREHENSIVE TEST SETUP 🧠\n');

    // Step 1: Create user
    const userData = await createTestUser();

    // Step 2: Provide verification steps
    await verifyUser(userData);

    // Step 3: Define test criteria
    await defineTestCriteria();

    // Step 4: Create test plan
    await createTestPlan();

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run the SQL commands above to verify user');
    console.log('2. Run: node ai-brain-test.js');
    console.log('3. Verify all test criteria are met');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

main();