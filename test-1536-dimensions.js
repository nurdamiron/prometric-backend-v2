const API_BASE = 'http://localhost:3333';

async function test1536Dimensions() {
  console.log('🚀 Testing 1536 dimensions embeddings\n');

  // Get token
  const tokenResponse = await fetch(`${API_BASE}/test/get-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aitest@prometric.kz', password: 'AiTest123!' })
  });
  const { access_token: token } = await tokenResponse.json();

  // Add comprehensive document
  console.log('📚 Adding comprehensive document...');
  const newDoc = {
    title: 'Prometric AI Brain Полная Документация',
    content: `
    Prometric AI Brain - интеллектуальная система для казахстанского бизнеса.

    БАНКОВСКИЕ ИНТЕГРАЦИИ:
    - Kaspi Business для онлайн платежей и QR кодов
    - Halyk Bank для корпоративного банкинга
    - Sberbank Kazakhstan для международных переводов
    - ATF Bank для эквайринга
    - ForteBank для валютных операций

    CRM ВОЗМОЖНОСТИ:
    - Управление клиентами и лидами
    - Автоматизация продаж
    - Воронка сделок с этапами
    - Планирование встреч
    - Email и SMS маркетинг

    АНАЛИТИКА И ОТЧЕТЫ:
    - Дашборды в реальном времени
    - Отчеты по продажам
    - Анализ конверсии воронки
    - ROI calculation
    - Прогнозирование продаж

    AI ФУНКЦИИ:
    - Персональный AI помощник
    - Анализ документов
    - Автоматические рекомендации
    - Умные уведомления
    - Обработка естественного языка
    `,
    accessLevel: 'public'
  };

  const addResponse = await fetch(`${API_BASE}/ai/knowledge/add-manual-content`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newDoc)
  });

  const addResult = await addResponse.json();
  console.log(`✅ Document added: ${addResult.data.documentId}`);

  // Process embeddings
  console.log('\n⚡ Processing 1536-dimension embeddings...');
  const embedResponse = await fetch(`${API_BASE}/ai/knowledge/process-embeddings/bulk`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('Processing started...');
  await new Promise(r => setTimeout(r, 10000));

  // Test searches
  console.log('\n🔍 Testing enhanced search quality:');

  const testQueries = [
    'банковские интеграции',
    'CRM функции',
    'аналитика продаж',
    'AI помощник',
    'воронка сделок'
  ];

  for (const query of testQueries) {
    const searchResponse = await fetch(`${API_BASE}/ai/knowledge/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, maxResults: 3 })
    });

    const result = await searchResponse.json();

    if (result.success) {
      console.log(`\n"${query}": ${result.data.resultsCount} results`);
      if (result.data.results && result.data.results.length > 0) {
        result.data.results.forEach((doc, i) => {
          console.log(`  ${i+1}. "${doc.title}" (${(doc.relevanceScore * 100).toFixed(1)}%)`);
        });
      }
    } else {
      console.log(`\n"${query}": ${result.data?.message || 'Error'}`);
    }
  }

  // Final stats
  console.log('\n📊 Final stats:');
  const statsResponse = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stats = await statsResponse.json();
  console.log(`Embeddings: ${stats.data.documentsWithEmbeddings}`);
  console.log(`Tokens: ${stats.data.totalTokensUsed}`);

  console.log('\n🎯 1536 dimensions test complete!');
}

test1536Dimensions().catch(console.error);