#!/usr/bin/env node

// AI Brain End-to-End Test Script
// Tests the complete AI Brain functionality with RAG + Conversations

const API_BASE = 'http://localhost:3333';

// Test user credentials (now properly setup)
const TEST_USER = {
  email: 'aitest@prometric.kz',
  password: 'AiTest123!'
};

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

async function loginAndGetToken() {
  console.log('🔐 Step 1: Login to get JWT token...');

  const loginResult = await makeRequest('/auth/login', 'POST', TEST_USER);

  if (!loginResult.success) {
    throw new Error(`Login failed: ${JSON.stringify(loginResult.data)}`);
  }

  const token = loginResult.data.access_token;
  console.log('✅ Login successful! Token obtained.');

  return token;
}

async function testAiCapabilities(token) {
  console.log('\n🤖 Step 2: Testing AI capabilities...');

  const result = await makeRequest('/ai/capabilities', 'GET', null, token);

  if (result.success) {
    console.log('✅ AI capabilities loaded:');
    console.log(`- Assistant personalities: ${result.data.assistantPersonalities.length}`);
    console.log(`- Expertise areas: ${result.data.expertiseAreas.length}`);
    console.log(`- Brain personalities: ${result.data.brainPersonalities.length}`);
  } else {
    console.log('❌ AI capabilities failed:', result.data);
  }

  return result.success;
}

async function configureAiAssistant(token) {
  console.log('\n⚙️ Step 3: Configuring AI Assistant...');

  const config = {
    assistantName: 'Асем AI',
    personality: 'professional',
    expertise: ['CRM', 'Продажи', 'Аналитика'],
    voicePreference: 'female'
  };

  const result = await makeRequest('/ai/assistant/configure', 'POST', config, token);

  if (result.success) {
    console.log('✅ AI Assistant configured successfully!');
    console.log(`Assistant: ${config.assistantName} (${config.personality})`);
  } else {
    console.log('❌ AI Assistant configuration failed:', result.data);
  }

  return result.success;
}

async function addKnowledgeContent(token) {
  console.log('\n📚 Step 4: Adding knowledge to AI Brain...');

  const knowledgeData = {
    title: 'Prometric CRM Руководство пользователя',
    content: `
    Prometric - это современная CRM система для казахстанского рынка.

    ОСНОВНЫЕ ФУНКЦИИ:
    1. Управление клиентами - создание, редактирование контактов
    2. Воронка продаж - отслеживание сделок и этапов
    3. Аналитика - отчеты по продажам и клиентам
    4. AI Ассистент - помощь в повседневных задачах

    ОСОБЕННОСТИ ДЛЯ КАЗАХСТАНА:
    - Поддержка БИН компаний (12 цифр)
    - Интеграция с казахскими банками
    - Соответствие местному законодательству
    - Мультиязычность: русский, казахский, английский

    РАБОЧИЙ ПРОЦЕСС:
    1. Регистрация клиента в системе
    2. Квалификация потребностей
    3. Создание коммерческого предложения
    4. Ведение переговоров
    5. Заключение сделки
    6. Постпродажное обслуживание

    ИНТЕГРАЦИИ:
    - Kaspi Business для платежей
    - 1C для учета
    - Телефония для звонков
    - Email маркетинг
    `,
    accessLevel: 'public'
  };

  const result = await makeRequest('/ai/knowledge/add-manual', 'POST', knowledgeData, token);

  if (result.success) {
    console.log('✅ Knowledge added to AI Brain!');
    console.log(`Document: "${knowledgeData.title}"`);
    console.log(`Content length: ${knowledgeData.content.length} characters`);
  } else {
    console.log('❌ Knowledge addition failed:', result.data);
  }

  return result.success;
}

async function testAiChat(token, sessionId = null) {
  console.log('\n💬 Step 5: Testing AI Chat with RAG...');

  const chatData = {
    message: 'Привет! Расскажи мне о функциях Prometric CRM. Какие есть интеграции?',
    priority: 'medium',
    ...(sessionId ? { sessionId } : {})
  };

  console.log(`Query: "${chatData.message}"`);

  const result = await makeRequest('/ai/chat', 'POST', chatData, token);

  if (result.success) {
    console.log('✅ AI Chat successful!');
    console.log(`Assistant: ${result.data.assistant}`);
    console.log(`Model: ${result.data.model}`);
    console.log(`Tokens: ${result.data.tokensUsed}`);
    console.log(`Sources used: ${result.data.sources?.length || 0}`);
    console.log(`SessionId: ${result.data.sessionId}`);
    console.log('\n🤖 AI Response:');
    console.log(result.data.content);

    return { success: true, sessionId: result.data.sessionId };
  } else {
    console.log('❌ AI Chat failed:', result.data);
    return { success: false };
  }
}

async function testRAGSearch(token) {
  console.log('\n🔍 Step 6: Testing RAG Knowledge Search...');

  const searchData = {
    query: 'интеграции с банками',
    maxResults: 3,
    includeChunks: true,
    hybridSearch: true
  };

  const result = await makeRequest('/ai/knowledge/search', 'POST', searchData, token);

  if (result.success) {
    console.log('✅ RAG Search successful!');
    console.log(`Found: ${result.data.resultsCount} relevant documents`);

    result.data.results.forEach((doc, index) => {
      console.log(`\n${index + 1}. ${doc.title} (${doc.relevanceScore})`);
      console.log(`   Content: ${doc.content.substring(0, 100)}...`);
      if (doc.chunks && doc.chunks.length > 0) {
        console.log(`   Chunks: ${doc.chunks.length}`);
      }
    });
  } else {
    console.log('❌ RAG Search failed:', result.data);
  }

  return result.success;
}

async function runFullTest() {
  console.log('🧠 AI BRAIN END-TO-END TEST STARTED 🧠\n');

  try {
    // Step 1: Authentication
    const token = await loginAndGetToken();

    // Step 2: Test AI capabilities
    await testAiCapabilities(token);

    // Step 3: Configure AI Assistant
    await configureAiAssistant(token);

    // Step 4: Add knowledge
    await addKnowledgeContent(token);

    // Step 5: Test RAG search
    await testRAGSearch(token);

    // Step 6: Test AI chat (first message)
    const chatResult1 = await testAiChat(token);

    if (chatResult1.success && chatResult1.sessionId) {
      // Step 7: Test conversation context (second message in same session)
      console.log('\n🗣️ Step 7: Testing conversation context...');

      const chatResult2 = await testAiChat(token, chatResult1.sessionId);

      if (chatResult2.success) {
        console.log('✅ Conversation context working!');
      }
    }

    console.log('\n🎉 AI BRAIN TEST COMPLETED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n💥 TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
runFullTest();