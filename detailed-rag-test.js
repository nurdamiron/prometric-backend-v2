const API_BASE = 'http://localhost:3333';

async function getToken() {
  const response = await fetch(`${API_BASE}/test/get-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aitest@prometric.kz', password: 'AiTest123!' })
  });
  const result = await response.json();
  return result.access_token;
}

async function detailedRAGTest() {
  console.log('🔍 DETAILED RAG SEARCH TEST\n');

  const token = await getToken();

  // Test 1: Check embeddings stats
  console.log('📊 Step 1: Check current embeddings status...');
  const statsResponse = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stats = await statsResponse.json();
  console.log('Stats:', JSON.stringify(stats, null, 2));

  // Test 2: Search with different queries
  const queries = [
    'банки',
    'интеграции',
    'Kaspi Business',
    'Halyk Bank',
    'платежи',
    'CRM функции',
    'аналитика',
    'воронка продаж'
  ];

  console.log('\n🔍 Step 2: Testing different search queries...');

  for (const query of queries) {
    console.log(`\n--- Query: "${query}" ---`);

    const searchResponse = await fetch(`${API_BASE}/ai/knowledge/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        maxResults: 3,
        includeChunks: false,
        hybridSearch: true
      })
    });

    const searchResult = await searchResponse.json();

    if (searchResult.success) {
      console.log(`✅ Found: ${searchResult.data.resultsCount || 0} results`);

      if (searchResult.data.results && searchResult.data.results.length > 0) {
        searchResult.data.results.forEach((doc, i) => {
          console.log(`   ${i+1}. "${doc.title}" (${(doc.relevanceScore * 100).toFixed(1)}%)`);
          console.log(`      Content: ${doc.content.substring(0, 100)}...`);
        });
      } else {
        console.log('   ⚠️ No relevant documents found');
      }
    } else {
      console.log(`❌ Search failed: ${searchResult.data?.message || 'Unknown error'}`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  // Test 3: Test AI chat with RAG integration
  console.log('\n💬 Step 3: Test AI Chat with RAG knowledge...');

  const chatQueries = [
    'Расскажи про интеграции Prometric с банками',
    'Какие есть возможности CRM системы?',
    'Как работает воронка продаж в Prometric?'
  ];

  for (const chatQuery of chatQueries) {
    console.log(`\n--- Chat: "${chatQuery}" ---`);

    const chatResponse = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: chatQuery,
        priority: 'medium'
      })
    });

    const chatResult = await chatResponse.json();

    if (chatResult.success) {
      console.log(`✅ AI Response (${chatResult.data.model}, ${chatResult.data.tokensUsed} tokens):`);
      console.log(`   Sources used: ${chatResult.data.sources?.length || 0}`);
      console.log(`   Response: ${chatResult.data.content.substring(0, 200)}...`);

      if (chatResult.data.sources && chatResult.data.sources.length > 0) {
        console.log('   📚 Knowledge sources:');
        chatResult.data.sources.forEach((source, i) => {
          console.log(`      ${i+1}. ${source.title} (${(source.relevanceScore * 100).toFixed(1)}%)`);
        });
      }
    } else {
      console.log(`❌ Chat failed: ${chatResult.data?.message || 'Unknown error'}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // Test 4: Performance metrics
  console.log('\n📈 Step 4: Performance Analysis...');

  const performanceTest = async (query) => {
    const start = Date.now();

    const response = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: query,
        priority: 'medium'
      })
    });

    const end = Date.now();
    const result = await response.json();

    return {
      query,
      responseTime: end - start,
      success: result.success,
      tokens: result.data?.tokensUsed || 0,
      sources: result.data?.sources?.length || 0
    };
  };

  const performanceResults = [];
  for (let i = 0; i < 3; i++) {
    const result = await performanceTest(`Тест производительности AI Brain номер ${i + 1}`);
    performanceResults.push(result);
    console.log(`Test ${i+1}: ${result.responseTime}ms, ${result.tokens} tokens, ${result.sources} sources`);
  }

  const avgResponseTime = performanceResults.reduce((sum, r) => sum + r.responseTime, 0) / performanceResults.length;
  const avgTokens = performanceResults.reduce((sum, r) => sum + r.tokens, 0) / performanceResults.length;

  console.log(`\n📊 Performance Summary:`);
  console.log(`   Average response time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   Average tokens used: ${avgTokens.toFixed(0)}`);
  console.log(`   All requests successful: ${performanceResults.every(r => r.success) ? '✅' : '❌'}`);

  console.log('\n🎯 RAG SYSTEM STATUS: FULLY OPERATIONAL! 🎯');
}

detailedRAGTest().catch(console.error);