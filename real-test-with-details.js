const API_BASE = 'http://localhost:3333';

async function showRealRequestsAndResponses() {
  console.log('🔍 REAL AI BRAIN TEST - SHOWING ACTUAL REQUESTS & RESPONSES\n');

  // Get token
  console.log('=== STEP 1: AUTHENTICATION ===');
  console.log('REQUEST:');
  console.log('POST /test/get-token');
  console.log('Body: {"email":"aitest@prometric.kz","password":"AiTest123!"}');

  const tokenResponse = await fetch(`${API_BASE}/test/get-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aitest@prometric.kz', password: 'AiTest123!' })
  });

  const tokenResult = await tokenResponse.json();
  console.log('\nRESPONSE:');
  console.log('Status:', tokenResponse.status);
  console.log('Body (shortened):', {
    success: tokenResult.success,
    access_token: tokenResult.access_token ? `${tokenResult.access_token.substring(0, 50)}...` : null,
    user: {
      email: tokenResult.user?.email,
      role: tokenResult.user?.role,
      organization: tokenResult.user?.organization?.name
    }
  });

  const token = tokenResult.access_token;

  // Test RAG Search
  console.log('\n=== STEP 2: RAG SEARCH TEST ===');
  console.log('REQUEST:');
  console.log('POST /ai/knowledge/search');
  console.log('Headers: Authorization: Bearer [token]');
  console.log('Body: {"query":"nitrile gloves specifications","maxResults":3,"includeChunks":false}');

  const ragQuery = {
    query: 'nitrile gloves specifications',
    maxResults: 3,
    includeChunks: false
  };

  const ragResponse = await fetch(`${API_BASE}/ai/knowledge/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ragQuery)
  });

  const ragResult = await ragResponse.json();
  console.log('\nRESPONSE:');
  console.log('Status:', ragResponse.status);
  console.log('Full Response:', JSON.stringify(ragResult, null, 2));

  // Test AI Chat
  console.log('\n=== STEP 3: AI CHAT TEST ===');
  console.log('REQUEST:');
  console.log('POST /ai/chat');
  console.log('Headers: Authorization: Bearer [token]');
  console.log('Body: {"message":"Tell me about nitrile gloves from our catalog","priority":"medium"}');

  const chatQuery = {
    message: 'Tell me about nitrile gloves from our catalog',
    priority: 'medium'
  };

  const start = Date.now();
  const chatResponse = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(chatQuery)
  });
  const responseTime = Date.now() - start;

  console.log('\nRESPONSE:');
  console.log('Status:', chatResponse.status);
  console.log('Response Time:', responseTime + 'ms');

  if (chatResponse.ok) {
    const chatResult = await chatResponse.json();
    console.log('Full Response:', JSON.stringify({
      assistant: chatResult.assistant,
      model: chatResult.model,
      tokensUsed: chatResult.tokensUsed,
      sourcesCount: chatResult.sources?.length || 0,
      sessionId: chatResult.sessionId,
      content: chatResult.content,
      sources: chatResult.sources
    }, null, 2));
  } else {
    const errorResult = await chatResponse.json();
    console.log('Error Response:', JSON.stringify(errorResult, null, 2));
  }

  // Test follow-up conversation
  if (chatResponse.ok) {
    const chatResult = await chatResponse.json();
    const sessionId = chatResult.sessionId;

    console.log('\n=== STEP 4: CONVERSATION CONTEXT TEST ===');
    console.log('REQUEST:');
    console.log('POST /ai/chat');
    console.log('Headers: Authorization: Bearer [token]');
    console.log(`Body: {"message":"What about their weight and packaging?","sessionId":"${sessionId}"}`);

    const followUpQuery = {
      message: 'What about their weight and packaging?',
      sessionId: sessionId
    };

    const followUpResponse = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(followUpQuery)
    });

    console.log('\nRESPONSE:');
    console.log('Status:', followUpResponse.status);

    if (followUpResponse.ok) {
      const followUpResult = await followUpResponse.json();
      console.log('Full Response:', JSON.stringify({
        assistant: followUpResult.assistant,
        model: followUpResult.model,
        tokensUsed: followUpResult.tokensUsed,
        sourcesCount: followUpResult.sources?.length || 0,
        sessionId: followUpResult.sessionId,
        sameSession: followUpResult.sessionId === sessionId,
        content: followUpResult.content,
        sources: followUpResult.sources
      }, null, 2));
    } else {
      const errorResult = await followUpResponse.json();
      console.log('Error Response:', JSON.stringify(errorResult, null, 2));
    }
  }

  // Test embeddings stats
  console.log('\n=== STEP 5: EMBEDDINGS STATS ===');
  console.log('REQUEST:');
  console.log('GET /ai/knowledge/embeddings/stats');
  console.log('Headers: Authorization: Bearer [token]');

  const statsResponse = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const statsResult = await statsResponse.json();
  console.log('\nRESPONSE:');
  console.log('Status:', statsResponse.status);
  console.log('Full Response:', JSON.stringify(statsResult, null, 2));

  console.log('\n🎯 REAL TEST COMPLETE - ALL ACTUAL DATA SHOWN ABOVE');
}

showRealRequestsAndResponses().catch(console.error);