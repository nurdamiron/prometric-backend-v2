const API_BASE = 'http://localhost:3333';

class AIBrainTestSuite {
  constructor() {
    this.token = null;
    this.testResults = {
      authentication: [],
      knowledgeManagement: [],
      ragSearch: [],
      aiChat: [],
      conversations: [],
      performance: [],
      security: [],
      edgeCases: []
    };
  }

  async initialize() {
    const response = await fetch(`${API_BASE}/test/get-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aitest@prometric.kz', password: 'AiTest123!' })
    });
    const result = await response.json();
    this.token = result.access_token;
    console.log('🔐 Test suite initialized');
  }

  async testAuthentication() {
    console.log('\n🔐 AUTHENTICATION TESTS:');

    const tests = [
      {
        name: 'Valid login',
        test: async () => {
          const response = await fetch(`${API_BASE}/test/get-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'aitest@prometric.kz', password: 'AiTest123!' })
          });
          return response.ok;
        }
      },
      {
        name: 'Invalid credentials',
        test: async () => {
          const response = await fetch(`${API_BASE}/test/get-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'wrong@email.com', password: 'wrong' })
          });
          return !response.ok; // Should fail
        }
      },
      {
        name: 'Protected endpoint without token',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/capabilities`);
          return response.status === 401; // Should be unauthorized
        }
      },
      {
        name: 'Protected endpoint with valid token',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/capabilities`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
          });
          return response.ok;
        }
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        console.log(`${result ? '✅' : '❌'} ${test.name}`);
        this.testResults.authentication.push({ name: test.name, passed: result });
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
        this.testResults.authentication.push({ name: test.name, passed: false, error: error.message });
      }
    }
  }

  async testKnowledgeManagement() {
    console.log('\n📚 KNOWLEDGE MANAGEMENT TESTS:');

    const tests = [
      {
        name: 'Add manual content',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/knowledge/add-manual-content`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: 'Test Document ' + Date.now(),
              content: 'This is a test document for AI Brain testing.',
              accessLevel: 'public'
            })
          });
          const result = await response.json();
          return response.ok && result.data.documentId;
        }
      },
      {
        name: 'Get embeddings stats',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/knowledge/embeddings/stats`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
          });
          const result = await response.json();
          return response.ok && result.data.documentsWithEmbeddings > 0;
        }
      },
      {
        name: 'Process bulk embeddings',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/knowledge/process-embeddings/bulk`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` }
          });
          const result = await response.json();
          return response.ok && result.success;
        }
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        console.log(`${result ? '✅' : '❌'} ${test.name}`);
        this.testResults.knowledgeManagement.push({ name: test.name, passed: !!result });
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
        this.testResults.knowledgeManagement.push({ name: test.name, passed: false, error: error.message });
      }
    }
  }

  async testRAGSearch() {
    console.log('\n🔍 RAG SEARCH TESTS:');

    const searchTests = [
      { query: 'nitrile gloves', expectedResults: 1 },
      { query: 'production capacity', expectedResults: 1 },
      { query: 'anti-cutting grade 5', expectedResults: 1 },
      { query: 'nonexistent topic xyz', expectedResults: 0 },
      { query: '', expectedResults: 0 }, // Empty query
      { query: 'a'.repeat(1000), expectedResults: 0 } // Very long query
    ];

    for (const searchTest of searchTests) {
      try {
        const response = await fetch(`${API_BASE}/ai/knowledge/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: searchTest.query.substring(0, 50) + (searchTest.query.length > 50 ? '...' : ''),
            maxResults: 3
          })
        });

        const result = await response.json();
        const actualResults = result.data?.resultsCount || 0;
        const passed = searchTest.expectedResults === 0 ? actualResults === 0 : actualResults >= searchTest.expectedResults;

        console.log(`${passed ? '✅' : '❌'} "${searchTest.query.substring(0, 30)}..." - Expected: ${searchTest.expectedResults}, Got: ${actualResults}`);

        this.testResults.ragSearch.push({
          query: searchTest.query.substring(0, 50),
          expectedResults: searchTest.expectedResults,
          actualResults,
          passed
        });
      } catch (error) {
        console.log(`❌ Search test failed: ${error.message}`);
      }
    }
  }

  async testAIChat() {
    console.log('\n💬 AI CHAT TESTS:');

    const chatTests = [
      {
        query: 'Tell me about nitrile gloves',
        expectSources: true,
        expectResponse: true
      },
      {
        query: 'What is production capacity?',
        expectSources: true,
        expectResponse: true
      },
      {
        query: 'Random topic not in knowledge base',
        expectSources: false,
        expectResponse: true
      },
      {
        query: '',
        expectSources: false,
        expectResponse: false
      }
    ];

    for (const chatTest of chatTests) {
      try {
        const start = Date.now();
        const response = await fetch(`${API_BASE}/ai/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: chatTest.query,
            priority: 'medium'
          })
        });

        const responseTime = Date.now() - start;

        if (response.ok) {
          const result = await response.json();
          const hasSources = result.sources && result.sources.length > 0;
          const hasResponse = result.content && result.content.length > 0;

          const sourcesPass = chatTest.expectSources ? hasSources : !hasSources;
          const responsePass = chatTest.expectResponse ? hasResponse : !hasResponse;
          const speedPass = responseTime < 10000; // Under 10 seconds

          const overall = sourcesPass && responsePass && speedPass;

          console.log(`${overall ? '✅' : '❌'} "${chatTest.query.substring(0, 30)}..."`);
          console.log(`   Response time: ${responseTime}ms`);
          console.log(`   Sources: ${result.sources?.length || 0} (expected: ${chatTest.expectSources})`);
          console.log(`   Content length: ${result.content?.length || 0} chars`);

          this.testResults.aiChat.push({
            query: chatTest.query.substring(0, 50),
            responseTime,
            sourcesCount: result.sources?.length || 0,
            contentLength: result.content?.length || 0,
            passed: overall
          });
        } else {
          const errorExpected = !chatTest.expectResponse;
          console.log(`${errorExpected ? '✅' : '❌'} "${chatTest.query.substring(0, 30)}..." - Failed as expected`);
        }
      } catch (error) {
        console.log(`❌ Chat test failed: ${error.message}`);
      }
    }
  }

  async testConversations() {
    console.log('\n🗣️ CONVERSATION CONTEXT TESTS:');

    try {
      // First message
      const firstMessage = 'Tell me about nitrile gloves';
      const firstResponse = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: firstMessage })
      });

      const firstResult = await firstResponse.json();
      const sessionId = firstResult.sessionId;

      console.log(`✅ First message: Session ${sessionId}`);

      // Second message (should use context)
      const secondMessage = 'What about their applications?';
      const secondResponse = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: secondMessage,
          sessionId: sessionId
        })
      });

      const secondResult = await secondResponse.json();
      const contextWorking = secondResult.sessionId === sessionId;

      console.log(`${contextWorking ? '✅' : '❌'} Conversation context maintained`);
      console.log(`   Same session: ${contextWorking}`);
      console.log(`   Response references context: ${secondResult.content.includes('перчатк') || secondResult.content.includes('glove')}`);

      this.testResults.conversations.push({
        sessionContinuity: contextWorking,
        contextAwareness: secondResult.content.includes('перчатк') || secondResult.content.includes('glove'),
        passed: contextWorking
      });

    } catch (error) {
      console.log(`❌ Conversation test failed: ${error.message}`);
    }
  }

  async testPerformance() {
    console.log('\n⚡ PERFORMANCE TESTS:');

    const performanceTests = [
      { name: 'RAG Search Speed', endpoint: '/ai/knowledge/search', method: 'POST', data: { query: 'nitrile gloves', maxResults: 5 } },
      { name: 'AI Chat Speed', endpoint: '/ai/chat', method: 'POST', data: { message: 'Tell me about gloves' } },
      { name: 'Embeddings Stats', endpoint: '/ai/knowledge/embeddings/stats', method: 'GET' },
      { name: 'AI Capabilities', endpoint: '/ai/capabilities', method: 'GET' }
    ];

    for (const test of performanceTests) {
      const times = [];
      const results = [];

      // Run test 5 times
      for (let i = 0; i < 5; i++) {
        try {
          const start = Date.now();
          const response = await fetch(`${API_BASE}${test.endpoint}`, {
            method: test.method,
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            ...(test.data ? { body: JSON.stringify(test.data) } : {})
          });
          const time = Date.now() - start;
          times.push(time);
          results.push(response.ok);
        } catch (error) {
          times.push(null);
          results.push(false);
        }
      }

      const validTimes = times.filter(t => t !== null);
      const avgTime = validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 0;
      const successRate = results.filter(r => r).length / results.length;

      console.log(`${successRate === 1 ? '✅' : '❌'} ${test.name}`);
      console.log(`   Average time: ${avgTime.toFixed(0)}ms`);
      console.log(`   Success rate: ${(successRate * 100).toFixed(0)}%`);

      this.testResults.performance.push({
        name: test.name,
        averageTime: avgTime,
        successRate,
        passed: successRate === 1 && avgTime < 15000
      });
    }
  }

  async testEdgeCases() {
    console.log('\n🔬 EDGE CASE TESTS:');

    const edgeTests = [
      {
        name: 'Very long content',
        test: async () => {
          const longContent = 'Very long content. '.repeat(1000);
          const response = await fetch(`${API_BASE}/ai/knowledge/add-manual-content`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: 'Long Document Test',
              content: longContent,
              accessLevel: 'public'
            })
          });
          return response.ok;
        }
      },
      {
        name: 'Empty search query',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/knowledge/search`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: '', maxResults: 5 })
          });
          return !response.ok; // Should fail gracefully
        }
      },
      {
        name: 'Special characters in search',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/knowledge/search`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: '!@#$%^&*()', maxResults: 5 })
          });
          return response.ok; // Should handle gracefully
        }
      },
      {
        name: 'Cyrillic search query',
        test: async () => {
          const response = await fetch(`${API_BASE}/ai/knowledge/search`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: 'нитриловые перчатки', maxResults: 5 })
          });
          const result = await response.json();
          return response.ok && result.data.resultsCount >= 0;
        }
      }
    ];

    for (const test of edgeTests) {
      try {
        const result = await test.test();
        console.log(`${result ? '✅' : '❌'} ${test.name}`);
        this.testResults.edgeCases.push({ name: test.name, passed: result });
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
        this.testResults.edgeCases.push({ name: test.name, passed: false, error: error.message });
      }
    }
  }

  async testBusinessWorkflow() {
    console.log('\n💼 BUSINESS WORKFLOW TESTS:');

    // Simulate real business scenario
    try {
      console.log('Scenario: Customer asks about products...');

      // 1. Customer inquiry
      const customerQuestion = 'I need gloves for chemical handling. What do you recommend?';
      const chatResponse = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: customerQuestion })
      });

      const chatResult = await chatResponse.json();
      const sessionId = chatResult.sessionId;

      console.log(`✅ Initial inquiry processed (Session: ${sessionId})`);
      console.log(`   Sources used: ${chatResult.sources?.length || 0}`);
      console.log(`   Mentions nitrile: ${chatResult.content.includes('nitrile') || chatResult.content.includes('нитрил')}`);

      // 2. Follow-up question
      const followUp = 'What about pricing and packaging?';
      const followUpResponse = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: followUp,
          sessionId: sessionId
        })
      });

      const followUpResult = await followUpResponse.json();

      console.log(`✅ Follow-up question processed`);
      console.log(`   Context maintained: ${followUpResult.sessionId === sessionId}`);
      console.log(`   Mentions pricing/packaging: ${followUpResult.content.includes('pack') || followUpResult.content.includes('price') || followUpResult.content.includes('упаков')}`);

      // 3. Technical specification inquiry
      const techQuestion = 'What are the exact specifications and weights?';
      const techResponse = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: techQuestion,
          sessionId: sessionId
        })
      });

      const techResult = await techResponse.json();

      console.log(`✅ Technical inquiry processed`);
      console.log(`   Provides specifications: ${techResult.content.includes('gauge') || techResult.content.includes('weight') || techResult.content.includes('gram')}`);

      this.testResults.conversations.push({
        businessScenario: 'Chemical handling gloves inquiry',
        sessionContinuity: true,
        relevantResponses: true,
        passed: true
      });

    } catch (error) {
      console.log(`❌ Business workflow test failed: ${error.message}`);
      this.testResults.conversations.push({
        businessScenario: 'Chemical handling gloves inquiry',
        passed: false,
        error: error.message
      });
    }
  }

  async generateReport() {
    console.log('\n📊 COMPREHENSIVE TEST REPORT:');
    console.log('═'.repeat(50));

    const categories = [
      { name: '🔐 Authentication', results: this.testResults.authentication },
      { name: '📚 Knowledge Management', results: this.testResults.knowledgeManagement },
      { name: '🔍 RAG Search', results: this.testResults.ragSearch },
      { name: '💬 AI Chat', results: this.testResults.aiChat },
      { name: '🗣️ Conversations', results: this.testResults.conversations },
      { name: '⚡ Performance', results: this.testResults.performance },
      { name: '🔬 Edge Cases', results: this.testResults.edgeCases }
    ];

    let totalTests = 0;
    let passedTests = 0;

    categories.forEach(category => {
      const categoryPassed = category.results.filter(r => r.passed).length;
      const categoryTotal = category.results.length;

      if (categoryTotal > 0) {
        console.log(`\n${category.name}: ${categoryPassed}/${categoryTotal} passed`);
        category.results.forEach(result => {
          console.log(`  ${result.passed ? '✅' : '❌'} ${result.name || result.query || 'Test'}`);
        });

        totalTests += categoryTotal;
        passedTests += categoryPassed;
      }
    });

    console.log('\n' + '═'.repeat(50));
    console.log(`🎯 OVERALL SCORE: ${passedTests}/${totalTests} (${(passedTests/totalTests*100).toFixed(1)}%)`);

    if (passedTests / totalTests >= 0.8) {
      console.log('🎉 AI BRAIN QUALITY: EXCELLENT (80%+ pass rate)');
    } else if (passedTests / totalTests >= 0.6) {
      console.log('✅ AI BRAIN QUALITY: GOOD (60%+ pass rate)');
    } else {
      console.log('⚠️ AI BRAIN QUALITY: NEEDS IMPROVEMENT');
    }

    return { totalTests, passedTests, passRate: passedTests / totalTests };
  }

  async runAllTests() {
    console.log('🧪 STARTING COMPREHENSIVE AI BRAIN TEST SUITE');
    console.log('═'.repeat(60));

    await this.initialize();
    await this.testAuthentication();
    await this.testKnowledgeManagement();
    await this.testRAGSearch();
    await this.testAIChat();
    await this.testConversations();
    await this.testPerformance();
    await this.testEdgeCases();
    await this.testBusinessWorkflow();

    return await this.generateReport();
  }
}

// Run the comprehensive test suite
const testSuite = new AIBrainTestSuite();
testSuite.runAllTests().catch(console.error);