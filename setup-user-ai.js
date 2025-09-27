const { Client } = require('pg');

async function setupUserAiConfig() {
  const db = new Client({
    host: 'prometric.cde42ec8m1u7.eu-north-1.rds.amazonaws.com',
    port: 5432,
    user: 'prometric',
    password: 'prometric01',
    database: 'prometric_new',
    ssl: { rejectUnauthorized: false }
  });

  await db.connect();

  // Check current user AI config
  const userQuery = await db.query(
    'SELECT id, email, "aiConfig" FROM users WHERE email = $1',
    ['aitest@prometric.kz']
  );

  console.log('Current user AI config:', userQuery.rows[0]);

  if (!userQuery.rows[0] || !userQuery.rows[0].aiConfig) {
    console.log('Setting up AI configuration for user...');

    const aiConfig = {
      assistantName: 'Асем AI',
      personality: 'professional',
      expertise: ['CRM', 'продажи', 'аналитика'],
      voicePreference: 'female',
      configuredAt: new Date().toISOString()
    };

    await db.query(
      'UPDATE users SET "aiConfig" = $1 WHERE email = $2',
      [JSON.stringify(aiConfig), 'aitest@prometric.kz']
    );

    console.log('✅ AI configuration set up for user');
  } else {
    console.log('✅ User already has AI configuration');
  }

  // Check latest conversation messages
  const messageQuery = await db.query(
    'SELECT session_id, content, ai_response, tokens_used, created_at FROM ai_conversation_messages ORDER BY created_at DESC LIMIT 2'
  );

  console.log('\nLatest conversation messages:');
  messageQuery.rows.forEach((msg, i) => {
    console.log(`  ${i + 1}. Content: "${msg.content?.substring(0, 50)}..."`);
    console.log(`     AI Response: "${msg.ai_response?.substring(0, 100)}..."`);
    console.log(`     Tokens: ${msg.tokens_used}`);
    console.log(`     Created: ${msg.created_at}`);
  });

  await db.end();
}

setupUserAiConfig().catch(console.error);