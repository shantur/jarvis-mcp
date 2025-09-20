#!/usr/bin/env node

// Test script to verify VoiceLogger functionality
process.env.VOICE_DEBUG = 'true';

console.log('Testing VoiceLogger with VOICE_DEBUG=true');

// Load the plugin
const pluginCode = require('fs').readFileSync('/Users/shantur/Coding/mcp-voice-hooks/mcp-browser-voice/.opencode/plugin/voice-interface.js', 'utf8');

// Extract and test VoiceLogger class
eval(pluginCode);

console.log('\n--- Testing VoiceLogger ---');
VoiceLogger.log('Test log message');
VoiceLogger.error('Test error message');
VoiceLogger.warn('Test warning message');

console.log('\n--- Setting VOICE_DEBUG=false ---');
process.env.VOICE_DEBUG = 'false';

VoiceLogger.log('This should not appear');
VoiceLogger.error('This should not appear');
VoiceLogger.warn('This should not appear');

console.log('\nTest completed!');