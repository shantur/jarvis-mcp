#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = './opencode-plugin/dist';
const outputFile = './opencode-plugin/dist/plugin.js';

console.log('Creating bundled plugin file...');

// Read all the compiled JS files
const voiceLoggerCode = fs.readFileSync(path.join(distDir, 'voice-logger.js'), 'utf8');
const voiceServiceCode = fs.readFileSync(path.join(distDir, 'voice-service.js'), 'utf8');
const indexCode = fs.readFileSync(path.join(distDir, 'index.js'), 'utf8');

// Create the bundled plugin
const bundledCode = `/**
 * OpenCode Voice Interface Plugin
 * 
 * This plugin integrates with the MCP Voice Interface to forward voice messages
 * to OpenCode sessions even when they are busy processing other tasks.
 * 
 * Installation: Copy this file to .opencode/plugin/ directory in your project
 * or globally to ~/.config/opencode/plugin/
 */

// === VoiceLogger ===
${voiceLoggerCode.replace(/export /g, '')}

// === VoiceMessageService ===
${voiceServiceCode.replace(/import.*from\s+["']\.\/.*["'];\n/g, '').replace(/export /g, '')}

// === Main Plugin ===
${indexCode.replace(/import.*from\s+["']\.\/.*["'];\n/g, '').replace(/export default /g, 'const VoiceInterfacePlugin = ')}

// Export the plugin for OpenCode (ES module)
export default VoiceInterfacePlugin;
`;

fs.writeFileSync(outputFile, bundledCode);
console.log('✅ Plugin bundle created:', outputFile);