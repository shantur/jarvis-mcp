#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = dirname(__dirname);

interface CLIOptions {
  installClaudeConfig?: boolean;
  installOpencodeConfig?: boolean;
  installClaudeCodeConfig?: boolean;
  installOpencodePlugin?: boolean;
  local?: boolean;
  global?: boolean;
  help?: boolean;
  version?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (const arg of args) {
    switch (arg) {
      case '--install-claude-config':
        options.installClaudeConfig = true;
        break;
      case '--install-opencode-config':
        options.installOpencodeConfig = true;
        break;
      case '--install-claude-code-config':
        options.installClaudeCodeConfig = true;
        break;
      case '--install-opencode-plugin':
        options.installOpencodePlugin = true;
        break;
      case '--local':
        options.local = true;
        break;
      case '--global':
        options.global = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
MCP Voice Interface - Browser-based voice input/output for AI Assistant conversations

Usage:
  npx mcp-voice-interface [options]

Options:
  --install-claude-config      Install configuration for Claude Desktop
  --install-opencode-config    Install configuration for OpenCode (creates opencode.json)
  --install-claude-code-config Install configuration for Claude Code CLI (creates .mcp.json)
  --install-opencode-plugin    Install OpenCode plugin for voice message forwarding
  --local                      Install config/plugin in current directory
  --global                     Install config/plugin globally
  --help, -h                   Show this help message
  --version, -v                Show version information

Examples:
  npx mcp-voice-interface                                     # Run the MCP server
  npx mcp-voice-interface --install-claude-config            # Setup for Claude Desktop
  npx mcp-voice-interface --install-opencode-config --local  # Setup for OpenCode in current dir  
  npx mcp-voice-interface --install-claude-code-config       # Setup for Claude Code CLI
  npx mcp-voice-interface --install-opencode-plugin --local  # Install OpenCode plugin in project
  
After installation:
  - Browser interface: https://localhost:5114 (HTTPS, recommended) or http://localhost:5113 (HTTP, fallback)
  - Use 'converse' tool or prompt for voice conversations
  - Adjust voice speed and select voices in the browser interface
`);
}

async function showVersion() {
  try {
    const { readFileSync } = await import('fs');
    const packageJsonPath = join(packageRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    console.log(`MCP Voice Interface v${packageJson.version}`);
  } catch {
    console.log('MCP Voice Interface (version unknown)');
  }
}

function installClaudeConfig() {
  const configDir = join(homedir(), 'Library', 'Application Support', 'Claude');
  const configFile = join(configDir, 'claude_desktop_config.json');
  
  console.log('Installing MCP Voice Interface for Claude Desktop...');
  
  // Create directory if it doesn't exist
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  const config = {
    mcpServers: {
      'mcp-voice-interface': {
        command: 'npx',
        args: ['mcp-voice-interface']
      }
    }
  };
  
  try {
    writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log('✅ Claude Desktop configuration installed successfully');
    console.log(`✅ Config file: ${configFile}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart Claude Desktop app');
    console.log('2. Use the "converse" tool for voice conversations');
    console.log('3. Browser interface will open at https://localhost:5114');
  } catch (error) {
    console.error('❌ Failed to install Claude Desktop configuration:', error);
    process.exit(1);
  }
}

function installOpencodeConfig(useLocal: boolean) {
  const configDir = useLocal ? process.cwd() : homedir();
  const configFile = join(configDir, 'opencode.json');
  
  console.log(`Installing MCP Voice Interface for OpenCode...`);
  console.log(`Config location: ${configFile}`);
  
  const config = {
    "$schema": "https://opencode.ai/config.json",
    mcp: {
      'mcp-voice-interface': {
        type: 'local',
        command: ['npx', 'mcp-voice-interface'],
        enabled: true
      }
    }
  };
  
  try {
    writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log('✅ OpenCode configuration installed successfully');
    console.log(`✅ Config file: ${configFile}`);
    console.log('');
    console.log('Next steps:');
    if (useLocal) {
      console.log('1. Make sure you\'re in this directory when starting OpenCode');
    }
    console.log('2. Start OpenCode');
    console.log('3. Use the "converse" tool for voice conversations');
    console.log('4. Browser interface will open at https://localhost:5114');
  } catch (error) {
    console.error('❌ Failed to install OpenCode configuration:', error);
    process.exit(1);
  }
}

function installClaudeCodeConfig(useLocal: boolean) {
  const configDir = useLocal ? process.cwd() : homedir();
  const configFile = join(configDir, '.mcp.json');
  
  console.log(`Installing MCP Voice Interface for Claude Code CLI...`);
  console.log(`Config location: ${configFile}`);
  
  // Claude Code CLI uses .mcp.json with mcpServers format (different from OpenCode)
  const config = {
    mcpServers: {
      'mcp-voice-interface': {
        command: 'npx',
        args: ['mcp-voice-interface']
      }
    }
  };
  
  try {
    writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log('✅ Claude Code CLI configuration installed successfully');
    console.log(`✅ Config file: ${configFile}`);
    console.log('');
    console.log('Next steps:');
    if (useLocal) {
      console.log('1. Make sure you\'re in this directory when starting Claude Code CLI');
    }
    console.log('2. Start Claude Code CLI with MCP support');
    console.log('3. Use the "converse" tool for voice conversations');
    console.log('4. Browser interface will open at https://localhost:5114');
  } catch (error) {
    console.error('❌ Failed to install Claude Code CLI configuration:', error);
    process.exit(1);
  }
}

function installOpencodePlugin(useLocal: boolean) {
  const pluginDir = useLocal 
    ? join(process.cwd(), '.opencode', 'plugin')
    : join(homedir(), '.config', 'opencode', 'plugin');
  const pluginFile = join(pluginDir, 'voice-interface.js');
  
  console.log(`Installing OpenCode Voice Interface Plugin...`);
  console.log(`Plugin location: ${pluginFile}`);
  
  // Read the built plugin file
  const pluginSourcePath = join(packageRoot, 'opencode-plugin', 'dist', 'plugin.js');
  
  try {
    // Create plugin directory if it doesn't exist
    mkdirSync(pluginDir, { recursive: true });
    
    // Copy the plugin file
    const pluginContent = readFileSync(pluginSourcePath, 'utf-8');
    writeFileSync(pluginFile, pluginContent);
    
    console.log('✅ OpenCode plugin installed successfully');
    console.log(`✅ Plugin file: ${pluginFile}`);
    console.log('');
    console.log('Next steps:');
    if (useLocal) {
      console.log('1. Make sure you\'re in this directory when starting OpenCode');
    }
    console.log('2. Start OpenCode');
    console.log('3. Plugin will automatically load and monitor for voice messages');
    console.log('4. Start MCP Voice Interface server: npx mcp-voice-interface');
    console.log('5. Use voice tools: voice_status(), voice_forward_now(), voice_configure()');
    console.log('');
    console.log('Environment variables (optional):');
    console.log('  VOICE_INTERFACE_URL=http://localhost:5113');
    console.log('  VOICE_POLL_INTERVAL=2000');
    console.log('  VOICE_MAX_MESSAGES=5');
    console.log('  VOICE_DEBUG=true');
  } catch (error) {
    console.error('❌ Failed to install OpenCode plugin:', error);
    process.exit(1);
  }
}

async function runMCPServer() {
  console.log('Starting MCP Voice Interface...');
  
  // Import and run the main server
  try {
    const { main } = await import('./index.js');
    await main();
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  if (options.version) {
    await showVersion();
    return;
  }
  
  // Handle installation commands
  if (options.installClaudeConfig) {
    installClaudeConfig();
    return;
  }
  
  if (options.installOpencodeConfig) {
    const useLocal = options.local || !options.global;
    installOpencodeConfig(useLocal);
    return;
  }
  
  if (options.installClaudeCodeConfig) {
    const useLocal = options.local || !options.global;
    installClaudeCodeConfig(useLocal);
    return;
  }
  
  if (options.installOpencodePlugin) {
    const useLocal = options.local || !options.global;
    installOpencodePlugin(useLocal);
    return;
  }
  
  // Default: run the MCP server
  await runMCPServer();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('❌ CLI error:', error);
  process.exit(1);
});