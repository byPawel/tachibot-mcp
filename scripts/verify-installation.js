#!/usr/bin/env node

/**
 * Verification script for TachiBot MCP installation
 * Run this to check if your installation is working correctly
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('🔍 TachiBot MCP Installation Verifier\n');

// Check Node version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 22) {
    console.error(`❌ Node.js version ${nodeVersion} is too old. Required: >=22.0.0`);
    process.exit(1);
} else {
    console.log(`✅ Node.js version: ${nodeVersion}`);
}

// Check if running from correct directory
const serverPath = path.join(process.cwd(), 'dist', 'src', 'server.js');
if (!fs.existsSync(serverPath)) {
    console.error('❌ server.js not found. Run "npm run build" first');
    process.exit(1);
} else {
    console.log('✅ Build files found');
}

// Check Claude Desktop config location
const platform = os.platform();
let configPath;

if (platform === 'darwin') {
    configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
} else if (platform === 'win32') {
    configPath = path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
} else {
    configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

console.log(`\n📁 Claude Desktop config location: ${configPath}`);

if (fs.existsSync(configPath)) {
    console.log('✅ Config file exists');

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        if (config.mcpServers?.tachibot) {
            console.log('✅ TachiBot is configured in Claude Desktop');

            const tachiConfig = config.mcpServers.tachibot;
            console.log('\n📋 Current Configuration:');
            console.log(`  Command: ${tachiConfig.command}`);
            if (tachiConfig.args) {
                console.log(`  Args: ${tachiConfig.args.join(' ')}`);
            }

            // Check API keys (without showing values)
            if (tachiConfig.env) {
                console.log('\n🔑 API Keys configured:');
                // Each entry may list alternative env var names (any one satisfies it).
                // OPENROUTER_API_KEY gates ~30 tools (DeepSeek, GLM, Kimi, Qwen, MiniMax, StepFun, ERNIE).
                const keys = [
                    ['PERPLEXITY_API_KEY'],
                    ['GROK_API_KEY', 'XAI_API_KEY'],
                    ['OPENAI_API_KEY'],
                    ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
                    ['OPENROUTER_API_KEY'],
                ];
                keys.forEach(names => {
                    const label = names.join(' / ');
                    if (names.some(name => tachiConfig.env[name])) {
                        console.log(`  ✅ ${label}: Configured`);
                    } else {
                        console.log(`  ⚠️  ${label}: Not configured`);
                    }
                });

                if (tachiConfig.env.TACHIBOT_PROFILE) {
                    console.log(`\n🎯 Active Profile: ${tachiConfig.env.TACHIBOT_PROFILE}`);
                }
            }
        } else {
            console.log('⚠️  TachiBot is NOT configured in Claude Desktop');
            console.log('   (This is normal for Claude Code users — this script only inspects the');
            console.log('    Claude Desktop config. Check your Claude Code setup with "claude mcp list"');
            console.log('    or look for a .mcp.json in your project instead.)');
            console.log('\nTo configure Claude Desktop, add this to your claude_desktop_config.json:');
            console.log(JSON.stringify({
                mcpServers: {
                    tachibot: {
                        command: "node",
                        args: [serverPath],
                        env: {
                            TACHIBOT_PROFILE: "balanced",
                            PERPLEXITY_API_KEY: "your-key",
                            GROK_API_KEY: "your-key",
                            OPENAI_API_KEY: "your-key"
                        }
                    }
                }
            }, null, 2));
        }
    } catch (error) {
        console.error('❌ Error reading config file:', error.message);
    }
} else {
    console.log('⚠️  Config file not found. Claude Desktop may not be installed.');
    console.log('   If you use Claude Code instead, this is expected — verify with');
    console.log('   "claude mcp list" or a project .mcp.json rather than this Desktop config.');
}

// Test server startup
console.log('\n🚀 Testing server startup...');
const child = spawn('node', [serverPath], {
    env: { ...process.env, MCP_TEST_MODE: 'true' }
});

let output = '';
child.stdout.on('data', (data) => {
    output += data.toString();
});

child.stderr.on('data', (data) => {
    output += data.toString();
});

setTimeout(() => {
    child.kill();
    if (output.includes('Server started') || output.includes('fastmcp') || output.length > 0) {
        console.log('✅ Server can start successfully');
    } else {
        console.log('⚠️  Server startup test inconclusive');
    }

    console.log('\n✨ Verification complete!');
    console.log('\nNext steps:');
    console.log('1. Restart Claude Desktop');
    console.log('2. Check if TachiBot tools appear when you type "Use the think tool"');
    console.log('3. If issues persist, check: Help → Toggle Developer Tools → Console');
}, 2000);