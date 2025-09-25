const API_BASE = 'http://localhost:3333';

async function testPDFKnowledge() {
  console.log('📄 TESTING AI BRAIN WITH PDF CONTENT\n');

  // Get token
  const tokenResponse = await fetch(`${API_BASE}/test/get-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aitest@prometric.kz', password: 'AiTest123!' })
  });
  const { access_token: token } = await tokenResponse.json();

  // Add key sections from PDF
  const pdfSections = [
    {
      title: 'Xinjiang Hengtai Company Profile',
      content: `
      Xinjiang Hengtai Textile Co., Ltd. is a full industry chain enterprise from textile, knitting to labor protection gloves.

      PRODUCTION CAPACITY:
      - 54,000 square meters standardized workshop
      - 8 labor protection glove dipping production lines
      - 2,000 intelligent fully automatic glove weaving machines
      - 6 spinning production lines
      - 2 polyester yarn production lines
      - Annual output: 300 million pairs of labor protection gloves
      - Annual output value: over 1 billion yuan
      - Employment: 300+ employees

      SALES NETWORK:
      - Domestic: Five provinces in Northwest China
      - Export: Russia, Central Asia, West Asia, Europe, America

      MISSION: Becoming a leading cotton textile enterprise, creating maximum value for employees, customers, and shareholders.
      `,
      accessLevel: 'public'
    },
    {
      title: 'Nitrile Coated Gloves Product Line',
      content: `
      NITRILE COATED GLOVES SPECIFICATIONS:

      1. Basic Nitrile Coated Gloves:
      - Material: 10 gauge cotton wire + nitrile
      - Sizes: 8/9
      - Weight: 30g, 35g, 42g per pair
      - Colors: blue, grey, green, red, black
      - Style: palm coated
      - Length: 22-25cm
      - Packing: 12 pairs/polybag, 960 pairs/woven bag

      2. Finger Strengthened Nitrile Gloves:
      - Material: 13 gauge polyester + nitrile
      - Weight: 60g per pair
      - Colors: orange/blue with black fingers
      - Style: half coated with finger reinforcement
      - Packing: 12 pairs/polybag, 720 pairs/woven bag

      PRODUCT CHARACTERISTICS:
      - Wear resistant and durable
      - Comfortable and breathable
      - Oil resistant and anti-corrosion
      - Non-slip texture technology
      - Good grip properties

      APPLICATIONS:
      - Hardware industry
      - Agricultural processing
      - Building materials
      - Petroleum & gas
      - Garden working
      - Appliance repair
      `,
      accessLevel: 'public'
    },
    {
      title: 'Latex and Rubber Gloves Catalog',
      content: `
      LATEX GLOVES PRODUCT RANGE:

      1. Half-coated Foam Latex Gloves:
      - Material: 13 gauge polyester + latex
      - Weight: 40g-51g per pair
      - Colors: Black/Green
      - Applications: Hardware, garden working, building materials

      2. Cotton Latex Coated Gloves:
      - Material: 10 gauge cotton + latex
      - Weight: 78g per pair
      - Colors: Grey yarn blue latex, Yellow yarn green latex
      - Applications: Heavy-duty work, construction

      3. Tire Rubber Coated Gloves:
      - Material: 13 gauge polyester + tire rubber
      - Weight: 47g-63g per pair
      - Colors: Green, Yellow, Purple (women's version)
      - Special features: Winter protection (-38°C tolerance)

      4. Anti-cutting Safety Gloves:
      - Material: 13 gauge glass fiber
      - Anti-cutting grade: 5
      - Anti-puncture grade: 4
      - Sizes: S, M, L, XL
      - Applications: Heavy industry, metal working

      SAFETY FEATURES:
      - Cut resistance level 5
      - Puncture protection
      - Chemical resistance
      - Temperature resistance
      - Enhanced grip technology
      `,
      accessLevel: 'public'
    }
  ];

  console.log('📚 Adding PDF content to AI Brain knowledge base...\n');

  for (let i = 0; i < pdfSections.length; i++) {
    const section = pdfSections[i];
    console.log(`Adding section ${i+1}: "${section.title}"`);

    const addResponse = await fetch(`${API_BASE}/ai/knowledge/add-manual-content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(section)
    });

    const result = await addResponse.json();
    if (result.success) {
      console.log(`✅ Added: ${result.data.documentId}`);
    } else {
      console.log(`❌ Failed: ${result.message}`);
    }
  }

  // Process embeddings
  console.log('\n⚡ Processing embeddings for PDF content...');
  await fetch(`${API_BASE}/ai/knowledge/process-embeddings/bulk`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  await new Promise(r => setTimeout(r, 15000)); // Wait for processing

  // Test searches with PDF content
  console.log('\n🔍 Testing RAG search with PDF knowledge...');

  const testQueries = [
    'nitrile gloves specifications',
    'anti-cutting gloves grade 5',
    'Xinjiang Hengtai production capacity',
    'latex gloves applications',
    'tire rubber gloves weight',
    'export markets Russia Central Asia'
  ];

  for (const query of testQueries) {
    const searchResponse = await fetch(`${API_BASE}/ai/knowledge/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, maxResults: 2 })
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
      console.log(`\n"${query}": Error - ${result.data?.message}`);
    }
  }

  // Test AI Chat with PDF knowledge
  console.log('\n💬 Testing AI Chat with PDF knowledge...');

  const chatQueries = [
    'Tell me about Xinjiang Hengtai company production capacity',
    'What are the specifications of nitrile coated gloves?',
    'Which gloves are best for anti-cutting protection?'
  ];

  for (const chatQuery of chatQueries) {
    console.log(`\n--- AI Chat: "${chatQuery}" ---`);

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

    if (chatResponse.ok) {
      const chatResult = await chatResponse.json();
      console.log(`✅ AI Response (${chatResult.sources?.length || 0} sources):`);
      console.log(`   ${chatResult.content.substring(0, 200)}...`);

      if (chatResult.sources && chatResult.sources.length > 0) {
        console.log('📚 Sources:');
        chatResult.sources.forEach((source, i) => {
          console.log(`  ${i+1}. ${source.title} (${(source.relevanceScore * 100).toFixed(1)}%)`);
        });
      }
    } else {
      console.log('❌ Chat failed');
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // Final stats
  console.log('\n📊 Final Knowledge Base Stats:');
  const statsResponse = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const stats = await statsResponse.json();
  console.log(`Total documents: ${stats.data.documentsWithEmbeddings}`);
  console.log(`Total tokens used: ${stats.data.totalTokensUsed}`);

  console.log('\n🎯 PDF KNOWLEDGE TEST COMPLETE!');
}

testPDFKnowledge().catch(console.error);