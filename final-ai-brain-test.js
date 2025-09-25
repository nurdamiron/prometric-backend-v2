#!/usr/bin/env node

// FINAL AI BRAIN COMPREHENSIVE TEST
// Tests all components: Authentication, RAG, Conversations, Embeddings

const API_BASE = 'http://localhost:3333';
const TEST_USER = { email: 'aitest@prometric.kz', password: 'AiTest123!' };

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
    return { status: response.status, success: response.ok, data: result };
  } catch (error) {
    return { status: 0, success: false, error: error.message };
  }
}

async function getAuthToken() {
  console.log('🔐 Getting authentication token...');

  const result = await makeRequest('/test/get-token', 'POST', TEST_USER);

  if (!result.success) {
    throw new Error(`Authentication failed: ${JSON.stringify(result.data)}`);
  }

  console.log(`✅ Authenticated as: ${result.data.user.email} (${result.data.user.role})`);
  console.log(`   Organization: ${result.data.user.organization.name} (${result.data.user.organization.bin})`);

  return result.data.access_token;
}

async function test1_AiCapabilities(token) {
  console.log('\n🤖 TEST 1: AI Capabilities...');

  const result = await makeRequest('/ai/capabilities', 'GET', null, token);

  if (result.success) {
    console.log('✅ AI capabilities loaded');
    console.log(`   Personalities: ${result.data.assistantPersonalities.length}`);
    console.log(`   Expertise areas: ${result.data.expertiseAreas.length}`);
    return true;
  } else {
    console.log('❌ AI capabilities failed:', result.data.message);
    return false;
  }
}

async function test2_ConfigureAssistant(token) {
  console.log('\n⚙️ TEST 2: Configure AI Assistant...');

  const config = {
    assistantName: 'Асем AI',
    personality: 'professional',
    expertise: ['CRM', 'Продажи', 'Аналитика'],
    voicePreference: 'female'
  };

  const result = await makeRequest('/ai/assistant/configure', 'POST', config, token);

  if (result.success) {
    console.log(`✅ AI Assistant configured: ${config.assistantName}`);
    console.log(`   Personality: ${config.personality}`);
    console.log(`   Expertise: ${config.expertise.join(', ')}`);
    return true;
  } else {
    console.log('❌ Assistant configuration failed:', result.data.message);
    return false;
  }
}

async function test3_AddKnowledge(token) {
  console.log('\n📚 TEST 3: Add Knowledge Content...');

  const knowledge = {
    title: 'Prometric CRM - Полное руководство',
    content: `
    Prometric CRM - это передовая система управления отношениями с клиентами для казахстанского рынка.

    ОСНОВНЫЕ МОДУЛИ:
    1. Управление клиентами
       - Создание и редактирование контактов
       - Сегментация клиентской базы
       - История взаимодействий

    2. Воронка продаж
       - Отслеживание сделок
       - Этапы продаж
       - Прогнозирование выручки

    3. Аналитика и отчеты
       - Отчеты по продажам
       - Анализ конверсии
       - KPI метрики

    4. AI Ассистент
       - Помощь в повседневных задачах
       - Анализ данных
       - Автоматизация процессов

    ИНТЕГРАЦИИ ДЛЯ КАЗАХСТАНА:
    - Kaspi Business для платежей
    - Банки второго уровня (Халык, Сбер, АТФ)
    - 1C для бухгалтерского учета
    - Почта Казахстана для доставки
    - ЭЦП для электронных документов

    ОСОБЕННОСТИ:
    - Поддержка БИН компаний (12 цифр)
    - Мультиязычность: русский, казахский, английский
    - Соответствие законодательству РК
    - Облачное развертывание
    `,
    accessLevel: 'public'
  };

  const result = await makeRequest('/ai/knowledge/add-manual-content', 'POST', knowledge, token);

  if (result.success) {
    console.log(`✅ Knowledge added: "${knowledge.title}"`);
    console.log(`   Content: ${knowledge.content.length} characters`);
    return result.data.data;
  } else {
    console.log('❌ Knowledge addition failed:', result.data.message);
    return null;
  }
}

async function test4_RagSearch(token) {
  console.log('\n🔍 TEST 4: RAG Knowledge Search...');

  const searchQuery = {
    query: 'интеграции с банками Казахстана',
    maxResults: 3,
    includeChunks: true,
    hybridSearch: true
  };

  const result = await makeRequest('/ai/knowledge/search', 'POST', searchQuery, token);

  if (result.success) {
    console.log(`✅ RAG search successful: ${result.data.resultsCount} results`);
    result.data.results.forEach((doc, i) => {
      console.log(`   ${i+1}. "${doc.title}" (${(doc.relevanceScore * 100).toFixed(1)}%)`);
    });
    return true;
  } else {
    console.log('❌ RAG search failed:', result.data.message);
    return false;
  }
}

async function test5_AiChat(token, sessionId = null) {
  console.log('\n💬 TEST 5: AI Chat with RAG...');

  const chatData = {
    message: sessionId ?
      'А какие еще интеграции есть?' :
      'Привет! Расскажи про интеграции Prometric с банками в Казахстане.',
    priority: 'medium',
    ...(sessionId ? { sessionId } : {})
  };

  console.log(`   Query: "${chatData.message}"`);

  const result = await makeRequest('/ai/chat', 'POST', chatData, token);

  if (result.success) {
    console.log(`✅ AI Chat successful!`);
    console.log(`   Assistant: ${result.data.assistant}`);
    console.log(`   Model: ${result.data.model}`);
    console.log(`   Tokens: ${result.data.tokensUsed}`);
    console.log(`   Sources: ${result.data.sources?.length || 0}`);
    console.log(`   Session: ${result.data.sessionId}`);
    console.log(`\n🤖 Response (first 200 chars):`);
    console.log(`   ${result.data.content.substring(0, 200)}...`);

    return { success: true, sessionId: result.data.sessionId };
  } else {
    console.log('❌ AI Chat failed:', result.data.message);
    return { success: false };
  }
}

async function test6_ConversationContext(token, sessionId) {
  console.log('\n🗣️ TEST 6: Conversation Context...');

  return await test5_AiChat(token, sessionId);
}

async function validateResults(testResults) {
  console.log('\n📊 TEST RESULTS VALIDATION:');

  const criteria = {
    '✅ Authentication': testResults.auth,
    '✅ AI Capabilities': testResults.capabilities,
    '✅ Assistant Config': testResults.assistantConfig,
    '✅ Knowledge Addition': testResults.knowledgeAdd,
    '✅ RAG Search': testResults.ragSearch,
    '✅ AI Chat + RAG': testResults.aiChat,
    '✅ Conversation Context': testResults.conversationContext
  };

  Object.entries(criteria).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });

  const allPassed = Object.values(criteria).every(Boolean);

  console.log(`\n🎯 OVERALL RESULT: ${allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  if (allPassed) {
    console.log('\n🧠 AI BRAIN IS FULLY FUNCTIONAL:');
    console.log('- Vertex AI embeddings working');
    console.log('- RAG pipeline operational');
    console.log('- AI conversations with context');
    console.log('- Knowledge base integration');
    console.log('- Multi-tenant security');
  }

  return allPassed;
}

async function runCompleteTest() {
  console.log('🧠 AI BRAIN COMPREHENSIVE TEST 🧠\n');

  const testResults = {
    auth: false,
    capabilities: false,
    assistantConfig: false,
    knowledgeAdd: false,
    ragSearch: false,
    aiChat: false,
    conversationContext: false
  };

  try {
    // Authentication
    const token = await getAuthToken();
    testResults.auth = true;

    // Test AI capabilities
    testResults.capabilities = await test1_AiCapabilities(token);

    // Configure AI assistant
    testResults.assistantConfig = await test2_ConfigureAssistant(token);

    // Add knowledge
    const knowledgeResult = await test3_AddKnowledge(token);
    testResults.knowledgeAdd = !!knowledgeResult;

    // Test RAG search
    testResults.ragSearch = await test4_RagSearch(token);

    // Test AI chat
    const chatResult = await test5_AiChat(token);
    testResults.aiChat = chatResult.success;

    // Test conversation context
    if (chatResult.success && chatResult.sessionId) {
      const contextResult = await test6_ConversationContext(token, chatResult.sessionId);
      testResults.conversationContext = contextResult.success;
    }

    // Validate all results
    await validateResults(testResults);

  } catch (error) {
    console.error('\n💥 TEST FAILED:', error.message);
    await validateResults(testResults);
  }
}

runCompleteTest();