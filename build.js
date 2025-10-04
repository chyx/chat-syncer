#!/usr/bin/env node

/**
 * Build script for chat-syncer userscript
 * Combines multiple source files into a single userscript
 */

const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Userscript header template
const header = `// ==UserScript==
// @name         ChatGPT Supabase Syncer (Unified)
// @namespace    http://tampermonkey.net/
// @version      ${version}
// @updateURL    https://raw.githubusercontent.com/chyx/chat-syncer/main/chat-syncer-unified.js
// @downloadURL  https://raw.githubusercontent.com/chyx/chat-syncer/main/chat-syncer-unified.js
// @description  Unified script: Sync ChatGPT conversations to Supabase & Config helper for Supabase dashboard
// @author       You
// @match        https://chatgpt.com/c/*
// @match        https://chat.openai.com/c/*
// @match        https://chatgpt.com/share/*
// @match        https://chat.openai.com/share/*
// @match        https://chatgpt.com/
// @match        https://chat.openai.com/
// @match        https://supabase.com/dashboard/project/*
// @match        https://app.supabase.com/project/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==
`;

// Source files in order
const sourceFiles = [
    'src/config.js',
    'src/chatgpt.js',
    'src/supabase.js',
    'src/main.js'
];

// Read and combine source files
console.log('Building chat-syncer-unified.js...');

let combinedCode = '';

for (const file of sourceFiles) {
    console.log(`  Adding ${file}...`);
    const content = fs.readFileSync(file, 'utf8');
    combinedCode += content + '\n\n';
}

// Wrap in IIFE
const wrappedCode = `(function() {
    'use strict';

${combinedCode}
})();
`;

// Combine header and code
const finalCode = header + '\n' + wrappedCode;

// Write output
const outputPath = 'chat-syncer-unified.js';
fs.writeFileSync(outputPath, finalCode);

console.log(`✅ Build complete: ${outputPath}`);
console.log(`   Version: ${version}`);
console.log(`   Size: ${Math.round(finalCode.length / 1024)} KB`);
