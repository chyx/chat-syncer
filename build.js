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
// @updateURL    https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js
// @downloadURL  https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js
// @description  Unified script: Sync ChatGPT conversations to Supabase & Config helper for Supabase dashboard
// @author       You
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// ==/UserScript==
`;

// Source files in order
const sourceFiles = [
    'src/config.js',
    'src/ui-helpers.js',
    'src/chatgpt.js',
    'src/supabase.js',
    'src/page-uploader.js',
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

// Wrap in IIFE with version injection
const wrappedCode = `(function() {
    'use strict';

    // Injected version number
    const SCRIPT_VERSION = '${version}';

${combinedCode}
})();
`;

// Combine header and code
const finalCode = header + '\n' + wrappedCode;

// Write output
const outputPath = 'chat-syncer-unified.user.js';
fs.writeFileSync(outputPath, finalCode);

console.log(`✅ Build complete: ${outputPath}`);
console.log(`   Version: ${version}`);
console.log(`   Size: ${Math.round(finalCode.length / 1024)} KB`);
