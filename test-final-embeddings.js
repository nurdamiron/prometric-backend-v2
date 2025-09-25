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

async function testEmbeddings() {
  const token = await getToken();
  console.log('🔐 Token obtained');

  // Test bulk embeddings
  console.log('\n📊 Testing bulk embeddings...');
  const bulkResponse = await fetch(`${API_BASE}/ai/knowledge/process-embeddings/bulk`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const bulkResult = await bulkResponse.json();
  console.log('Bulk result:', bulkResult);

  // Wait a bit for processing
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test RAG search
  console.log('\n🔍 Testing RAG search...');
  const searchResponse = await fetch(`${API_BASE}/ai/knowledge/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'интеграции с банками',
      maxResults: 3,
      includeChunks: true
    })
  });
  const searchResult = await searchResponse.json();
  console.log('Search result:', searchResult);

  // Check embeddings stats
  console.log('\n📈 Checking embeddings stats...');
  const statsResponse = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const statsResult = await statsResponse.json();
  console.log('Stats:', statsResult);
}

testEmbeddings().catch(console.error);