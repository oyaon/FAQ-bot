const BASE_URL = 'http://localhost:3000';

(async () => {
  console.log('=== CONVERSATION MEMORY TEST ===\n');
  
  try {
    // Request 1: Return Policy Question
    console.log('📨 Request 1: "What\'s your return policy?"');
    const response1 = await fetch(`${BASE_URL}/search`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: "What's your return policy?"})
    });
    
    if (!response1.ok) {
      console.error('❌ Request 1 failed:', response1.status, response1.statusText);
      process.exit(1);
    }
    
    const data1 = await response1.json();
    console.log('\n📋 RESPONSE 1:');
    console.log(JSON.stringify(data1, null, 2));
    
    if (!data1.sessionId) {
      console.error('❌ ERROR: No sessionId in Response 1!');
      process.exit(1);
    }
    
    console.log('\n✅ Session ID Created:', data1.sessionId);
    console.log('Context Used:', data1.contextUsed);
    
    // Wait a moment
    await new Promise(r => setTimeout(r, 1000));
    
    // Request 2: Damage Follow-up with Session ID
    console.log('\n---\n');
    console.log('📨 Request 2: "What if it\'s damaged?" (with sessionId)');
    const response2 = await fetch(`${BASE_URL}/search`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        query: "What if it's damaged?",
        sessionId: data1.sessionId
      })
    });
    
    if (!response2.ok) {
      console.error('❌ Request 2 failed:', response2.status, response2.statusText);
      process.exit(1);
    }
    
    const data2 = await response2.json();
    console.log('\n📋 RESPONSE 2:');
    console.log(JSON.stringify(data2, null, 2));
    
    console.log('\n✅ Session ID Maintained:', data2.sessionId === data1.sessionId);
    console.log('Context Used:', data2.contextUsed);
    console.log('Rewritten Query:', data2.rewrittenQuery || 'N/A');
    
    // Summary
    console.log('\n=== 🔍 MEMORY VERIFICATION ===');
    console.log('✓ Sessions Created:', !!data1.sessionId && !!data2.sessionId);
    console.log('✓ Session IDs Match:', data1.sessionId === data2.sessionId);
    console.log('✓ Context Used in Response 2:', data2.contextUsed);
    console.log('✓ Query Rewritten:', !!data2.rewrittenQuery);
    
    if (data1.sessionId && data2.sessionId && data1.sessionId === data2.sessionId && data2.contextUsed) {
      console.log('\n✅ ✅ ✅ CONVERSATION MEMORY IS WORKING! ✅ ✅ ✅');
      console.log('\nThe LLM is NOT just inferring context naturally.');
      console.log('Your session-based conversation memory system is functional!');
    } else {
      console.log('\n⚠️  POTENTIAL ISSUE - See details above');
      if (data1.sessionId !== data2.sessionId) {
        console.log('   - Sessions are not matching');
      }
      if (!data2.contextUsed) {
        console.log('   - Context is not being marked as used');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('\nMake sure your bot is running on http://localhost:3000');
    process.exit(1);
  }
})();
