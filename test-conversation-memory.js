const https = require('https');

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'faq-bot-lwt1.onrender.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (e) => reject(e));
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testConversationMemory() {
  console.log('=== Testing Conversation Memory ===\n');
  
  // Generate a session ID
  const sessionId = 'test-session-' + Date.now();
  console.log(`Session ID: ${sessionId}\n`);
  
  // Test 1: Ask about return policy
  console.log('Test 1: Asking "What is your return policy?"');
  const response1 = await makeRequest('/search', 'POST', {
    sessionId: sessionId,
    query: "What is your return policy?"
  });


  console.log(`Status: ${response1.status}`);
  console.log(`Answer: ${response1.data.answer?.substring(0, 150)}...`);
  console.log(`Route: ${response1.data.route}`);
  console.log(`LLM Used: ${response1.data.llmUsed}\n`);
  
  // Test 2: Follow-up with context-dependent question
  console.log('Test 2: Follow-up "What if the item is damaged?"');
  const response2 = await makeRequest('/search', 'POST', {
    sessionId: sessionId,
    query: "What if the item is damaged?"
  });


  console.log(`Status: ${response2.status}`);
  console.log(`Answer: ${response2.data.answer?.substring(0, 150)}...`);
  console.log(`Route: ${response2.data.route}`);
  console.log(`LLM Used: ${response2.data.llmUsed}`);
  console.log(`Top Result: ${response2.data.topResult?.question || 'None'}`);
  console.log(`Category: ${response2.data.topResult?.category || 'None'}\n`);
  
  // Test 3: Another follow-up with pronoun
  console.log('Test 3: Follow-up "How long does it take?"');
  const response3 = await makeRequest('/search', 'POST', {
    sessionId: sessionId,
    query: "How long does it take?"
  });


  console.log(`Status: ${response3.status}`);
  console.log(`Answer: ${response3.data.answer?.substring(0, 150)}...`);
  console.log(`Route: ${response3.data.route}`);
  console.log(`LLM Used: ${response3.data.llmUsed}\n`);
  
  console.log('=== Conversation Memory Tests Complete ===');
  console.log('\nExpected behavior:');
  console.log('- Follow-up questions should use context from previous messages');
  console.log('- The bot should understand "it" refers to the return/refund process');
  console.log('- LLM synthesis may be used for context-dependent queries');
}

testConversationMemory().catch(err => {
  console.error('Test error:', err.message);
});
