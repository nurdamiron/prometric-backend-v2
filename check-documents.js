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

async function addDocument(token) {
  console.log('📚 Adding test document...');

  const doc = {
    title: 'Казахстанские банки интеграции',
    content: 'Prometric интегрируется с Kaspi Business, Halyk Bank, Sberbank Kazakhstan для платежей и финансовых операций.',
    accessLevel: 'public'
  };

  const response = await fetch(`${API_BASE}/ai/knowledge/add-manual-content`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(doc)
  });

  const result = await response.json();
  console.log('Document added:', result);
  return result;
}

async function main() {
  const token = await getToken();

  // Add document
  await addDocument(token);

  // Check stats before embeddings
  console.log('\n📊 Stats before embeddings:');
  const statsBefore = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(await statsBefore.json());

  // Process embeddings
  console.log('\n⚡ Processing embeddings...');
  const embedResponse = await fetch(`${API_BASE}/ai/knowledge/process-embeddings/bulk`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(await embedResponse.json());

  // Wait and check stats after
  await new Promise(r => setTimeout(r, 10000));

  console.log('\n📊 Stats after embeddings:');
  const statsAfter = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(await statsAfter.json());

  // Test search
  console.log('\n🔍 Testing search:');
  const searchResponse = await fetch(`${API_BASE}/ai/knowledge/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: 'банки', maxResults: 3 })
  });
  console.log(await searchResponse.json());
}

main().catch(console.error);