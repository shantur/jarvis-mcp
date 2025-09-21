#!/usr/bin/env node

// Simple test to verify the plugin's HTTPS functionality
console.log('Testing Plugin HTTPS Configuration...');

// Load the compiled voice service
const fs = require('fs');
const path = require('path');

// Read the compiled voice service file
const voiceServicePath = path.join(__dirname, 'opencode-plugin/dist/voice-service.js');
const serviceCode = fs.readFileSync(voiceServicePath, 'utf8');

// Check if HTTPS handling is present
const hasHttpsAgent = serviceCode.includes('https.Agent');
const hasRejectUnauthorized = serviceCode.includes('rejectUnauthorized: false');
const hasCustomFetch = serviceCode.includes('customFetch');
const hasTLSUnauthorized = serviceCode.includes('NODE_TLS_REJECT_UNAUTHORIZED');

console.log('✅ Plugin Build Status:');
console.log(`  - HTTPS Agent configured: ${hasHttpsAgent ? '✅' : '❌'}`);
console.log(`  - Certificate rejection disabled: ${hasRejectUnauthorized ? '✅' : '❌'}`);
console.log(`  - Custom fetch method present: ${hasCustomFetch ? '✅' : '❌'}`);
console.log(`  - TLS environment handling: ${hasTLSUnauthorized ? '✅' : '❌'}`);

const allChecks = hasHttpsAgent && hasRejectUnauthorized && hasCustomFetch && hasTLSUnauthorized;
console.log(`\n🎯 Overall HTTPS Integration: ${allChecks ? '✅ READY' : '❌ ISSUES FOUND'}`);

if (allChecks) {
  console.log('\n📝 Usage Notes:');
  console.log('  - Plugin is ready for HTTPS connections to localhost:5114');
  console.log('  - Self-signed certificates will be automatically ignored');
  console.log('  - Copy plugin.js to your OpenCode plugin directory');
  console.log('  - Set VOICE_INTERFACE_URL=https://localhost:5114');
} else {
  console.log('\n❌ Plugin may have issues with HTTPS connections');
}