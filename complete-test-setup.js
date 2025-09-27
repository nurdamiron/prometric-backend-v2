#!/usr/bin/env node

/**
 * Complete test setup: register, verify, login, test
 */

const API_BASE_URL = 'http://localhost:3333';
const fs = require('fs');

async function completeTestSetup() {
  try {
    console.log('🚀 Complete Test Setup for Deep Business Analysis');
    console.log('================================================');
    
    // Step 1: Register test user
    console.log('\n📝 Step 1: Registering test user...');
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
      const registerData = await registerResponse.json();
      console.log('✅ User registered successfully');
      console.log(`📧 Verification code: ${registerData.verificationCode}`);
      
      // Step 2: Verify email
      console.log('\n📧 Step 2: Verifying email...');
      const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@elitetex.kz',
          code: registerData.verificationCode
        })
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        console.log('✅ Email verified successfully');
        console.log(`🔑 Access token: ${verifyData.accessToken?.substring(0, 50)}...`);
        
        // Save token
        if (verifyData.accessToken) {
          fs.writeFileSync('token.txt', verifyData.accessToken);
          console.log('💾 Token saved to token.txt');
          
          // Step 3: Test the endpoint
          console.log('\n🧠 Step 3: Testing Deep Business Analysis...');
          const testResponse = await fetch(`${API_BASE_URL}/ai/knowledge/analyze-business`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${verifyData.accessToken}`
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
        } else {
          console.log('❌ No access token received');
        }
      } else {
        const errorText = await verifyResponse.text();
        console.log('❌ Email verification failed:', errorText);
      }
    } else {
      console.log('ℹ️ User might already exist, trying login...');
      
      // Try login
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

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        console.log('✅ Login successful');
        
        if (loginData.accessToken) {
          fs.writeFileSync('token.txt', loginData.accessToken);
          console.log('💾 Token saved to token.txt');
          
          // Test endpoint
          console.log('\n🧠 Testing Deep Business Analysis...');
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
        } else {
          console.log('❌ No access token in login response');
        }
      } else {
        const errorText = await loginResponse.text();
        console.log('❌ Login failed:', errorText);
      }
    }

  } catch (error) {
    console.error('💥 Setup failed:', error.message);
  }
}

// Run the complete setup
completeTestSetup();