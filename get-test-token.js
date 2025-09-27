#!/usr/bin/env node

/**
 * Get test JWT token for API testing
 */

const API_BASE_URL = 'http://localhost:3333';

async function getTestToken() {
  try {
    console.log('🔐 Getting test JWT token...');
    
    // Step 1: Register test user
    const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@elitetex.kz',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        language: 'ru'
      })
    });

    if (registerResponse.ok) {
      console.log('✅ Test user registered successfully');
    } else {
      console.log('ℹ️ Test user might already exist');
    }

    // Step 2: Login to get token
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@elitetex.kz',
        password: 'TestPassword123!'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    
    console.log('✅ Login successful');
    console.log('📝 Token saved to token.txt');
    
    // Save token to file
    const fs = require('fs');
    if (loginData.accessToken) {
      fs.writeFileSync('token.txt', loginData.accessToken);
      return loginData.accessToken;
    } else {
      console.log('❌ No access token in response:', loginData);
      return null;
    }

  } catch (error) {
    console.error('❌ Failed to get token:', error.message);
    return null;
  }
}

// Run the script
getTestToken().then(token => {
  if (token) {
    console.log('🎉 Token obtained successfully!');
    console.log('🔑 Token:', token.substring(0, 50) + '...');
  } else {
    console.log('💥 Failed to obtain token');
  }
});