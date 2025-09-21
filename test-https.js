#!/usr/bin/env node

// Test HTTPS certificate ignoring functionality
console.log('Testing HTTPS certificate ignoring...');

async function testHttpsConnection() {
  const url = 'https://localhost:5114/api/status';
  
  // Save original setting
  const originalSetting = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  
  try {
    console.log(`Attempting to connect to: ${url}`);
    
    // Set to ignore certificates
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('Set NODE_TLS_REJECT_UNAUTHORIZED=0');
    
    const response = await fetch(url);
    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response data:', data);
      console.log('✅ HTTPS certificate ignoring works!');
    } else {
      console.log('❌ Got non-OK response');
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    // Restore original setting
    if (originalSetting !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalSetting;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
    console.log('Restored original TLS setting');
  }
}

testHttpsConnection();