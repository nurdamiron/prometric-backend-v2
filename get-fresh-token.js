#!/usr/bin/env node

/**
 * Get fresh JWT token with correct credentials
 */

const API_BASE_URL = 'http://localhost:3333';
const fs = require('fs');

async function getFreshToken() {
  try {
    console.log('🔐 Getting fresh JWT token with correct credentials...');
    
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'aitest@prometric.kz',
        password: 'AiTest123!'
      })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} - ${errorText}`);
    }

    const loginData = await loginResponse.json();
    
    console.log('✅ Login successful');
    console.log(`👤 User: ${loginData.user.firstName} ${loginData.user.lastName}`);
    console.log(`🏢 Organization: ${loginData.user.organization?.name || 'None'}`);
    console.log(`🔑 Token: ${loginData.accessToken?.substring(0, 50)}...`);
    
    // Save token to file
    if (loginData.accessToken) {
      fs.writeFileSync('fresh-token.txt', loginData.accessToken);
      console.log('💾 Token saved to fresh-token.txt');
      
      // Test the endpoint immediately
      console.log('\n🧠 Testing Deep Business Analysis endpoint...');
      const testResponse = await fetch(`${API_BASE_URL}/ai/knowledge/analyze-business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginData.accessToken}`
        },
        body: JSON.stringify({
          url: 'elitetex.kz',
          accessLevel: 'public',
          language: 'ru'
        })
      });

      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('✅ Deep Business Analysis Test Successful!');
        console.log(`🏢 Business Type: ${testData.data.businessType}`);
        console.log(`🏭 Industry: ${testData.data.industry}`);
        console.log(`🎯 AI Confidence: ${Math.round(testData.data.aiConfidence * 100)}%`);
        console.log(`💾 Analysis ID: ${testData.data.analysisId}`);
        console.log(`💾 Saved to Database: ✅`);
      } else {
        const errorText = await testResponse.text();
        console.log('❌ Test failed:', errorText);
      }
      
      return loginData.accessToken;
    } else {
      console.log('❌ No access token in response');
      return null;
    }

  } catch (error) {
    console.error('❌ Failed to get token:', error.message);
    return null;
  }
}

// Run the script
getFreshToken().then(token => {
  if (token) {
    console.log('\n🎉 Success! Fresh token obtained and endpoint tested!');
  } else {
    console.log('\n💥 Failed to obtain fresh token');
  }
});