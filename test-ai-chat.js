const API_BASE = 'http://localhost:3333';

async function testAIChat() {
  console.log('💬 Testing AI Chat detailed...\n');

  // Get token
  const tokenResponse = await fetch(`${API_BASE}/test/get-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aitest@prometric.kz', password: 'AiTest123!' })
  });
  const { access_token: token } = await tokenResponse.json();

  console.log('✅ Token obtained');

  // Test simple chat
  console.log('\n💬 Testing simple AI chat...');
  const start = Date.now();

  const chatResponse = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Привет! Расскажи про банковские интеграции в нашей системе.',
      priority: 'medium'
    })
  });

  const responseTime = Date.now() - start;
  console.log(`Response time: ${responseTime}ms`);

  if (chatResponse.ok) {
    const chatResult = await chatResponse.json();
    console.log('\n✅ AI Chat successful!');
    console.log(`Assistant: ${chatResult.assistant}`);
    console.log(`Model: ${chatResult.model}`);
    console.log(`Tokens: ${chatResult.tokensUsed}`);
    console.log(`Sources: ${chatResult.sources?.length || 0}`);
    console.log(`Session: ${chatResult.sessionId}`);
    console.log(`\nResponse: ${chatResult.content.substring(0, 200)}...`);

    if (chatResult.sources && chatResult.sources.length > 0) {
      console.log('\n📚 Knowledge sources used:');
      chatResult.sources.forEach((source, i) => {
        console.log(`  ${i+1}. ${source.title} (${(source.relevanceScore * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('\n⚠️ No RAG sources used - AI answered from general knowledge');
    }

    return chatResult;
  } else {
    const error = await chatResponse.json();
    console.log('\n❌ AI Chat failed:');
    console.log(`Status: ${chatResponse.status}`);
    console.log(`Error: ${error.message}`);
    console.log(`Details: ${JSON.stringify(error, null, 2)}`);
    return null;
  }
}

testAIChat().catch(console.error);