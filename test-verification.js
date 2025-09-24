const axios = require('axios');

const API_BASE = 'http://localhost:3333/api/v1';

async function testVerification() {
  try {
    console.log('🧪 Testing verification API...');

    // Test with invalid code
    console.log('\n1. Testing with invalid code...');
    const invalidResponse = await axios.post(`${API_BASE}/auth/verify-email-code`, {
      email: 'nurdaulet@expanse.kz',
      code: '883511'
    });
    console.log('Invalid code response:', invalidResponse.data);

    // Test sending new verification code
    console.log('\n2. Sending new verification code...');
    const sendResponse = await axios.post(`${API_BASE}/auth/send-verification-code`, {
      email: 'nurdaulet@expanse.kz',
      language: 'ru'
    });
    console.log('Send code response:', sendResponse.data);

  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('Network Error:', error.message);
    }
  }
}

testVerification();