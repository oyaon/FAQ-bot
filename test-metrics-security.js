const http = require('http');

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function runTests() {
  console.log('=== Testing Metrics Endpoint Security ===\n');

  // Test 1: Request without API key (should fail with 401)
  console.log('Test 1: GET /metrics without API key');
  try {
    const result1 = await makeRequest('/metrics');
    console.log(`  Status: ${result1.status}`);
    console.log(`  Expected: 401 Unauthorized`);
    console.log(`  Result: ${result1.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 2: Request with valid API key (should succeed)
  console.log('Test 2: GET /metrics with valid API key');
  try {
    const validKey = 'f47151431d5a32aa086cef79ad444aad';
    const result2 = await makeRequest('/metrics', { 'x-api-key': validKey });
    console.log(`  Status: ${result2.status}`);
    console.log(`  Expected: 200 OK`);
    console.log(`  Result: ${result2.status === 200 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 3: Request with invalid API key (should fail with 401)
  console.log('Test 3: GET /metrics with invalid API key');
  try {
    const result3 = await makeRequest('/metrics', { 'x-api-key': 'wrong-key' });
    console.log(`  Status: ${result3.status}`);
    console.log(`  Expected: 401 Unauthorized`);
    console.log(`  Result: ${result3.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 4: Test sub-endpoint without API key
  console.log('Test 4: GET /metrics/top-queries without API key');
  try {
    const result4 = await makeRequest('/metrics/top-queries');
    console.log(`  Status: ${result4.status}`);
    console.log(`  Expected: 401 Unauthorized`);
    console.log(`  Result: ${result4.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  console.log('=== Tests Complete ===');
}

runTests();
