#!/usr/bin/env node

'use strict';

const { exec, execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ── Resolve project root ───────────────────────────────
// When installed via `npm install -g .`, __dirname points to <global>/node_modules/nexanime/bin/
// which is a copy of our bin/ dir. We need to go up to find .next and package.json.
// When run locally via `node bin/nexanime.js`, same logic applies.
const projectDir = path.resolve(__dirname, '..');

// Verify this is the right directory
if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
  console.error('Error: Could not find NexAnime project root.');
  console.error('Make sure you ran the install script from the NexAnime directory.');
  process.exit(1);
}

// ── Ensure build exists ────────────────────────────────
const nextDir = path.join(projectDir, '.next');
if (!fs.existsSync(nextDir)) {
  console.log('\n  First run detected — building NexAnime...\n');
  try {
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
  } catch {
    console.error('\n  Build failed. Run "npm run build" manually and try again.\n');
    process.exit(1);
  }
}

// ── Config ─────────────────────────────────────────────
const port = process.env.PORT || 3000;
const url = `http://localhost:${port}`;

// ── Start server ───────────────────────────────────────
const isWin = process.platform === 'win32';

console.log(`\n  Starting NexAnime on port ${port}...\n`);

const server = exec(`npx next start -p ${port}`, {
  cwd: projectDir,
  windowsHide: true,
});

server.stdout?.pipe(process.stdout);
server.stderr?.pipe(process.stderr);

// ── Open browser when server is ready ──────────────────
let attempts = 0;
const maxAttempts = 30;

const checkReady = setInterval(() => {
  http
    .get(url, (res) => {
      if (res.statusCode) {
        clearInterval(checkReady);
        console.log(`\n  NexAnime is running at ${url}\n`);
        openBrowser(url);
      }
    })
    .on('error', () => {
      if (++attempts > maxAttempts) {
        clearInterval(checkReady);
        console.log(`\n  Server may still be starting. Open ${url} in your browser.\n`);
      }
    });
}, 1000);

function openBrowser(targetUrl) {
  try {
    if (isWin) {
      // Windows: use cmd /c start (handle & in URLs)
      spawn('cmd', ['/c', 'start', targetUrl.replace(/&/g, '^&')], {
        stdio: 'ignore',
        detached: true,
      }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [targetUrl], { stdio: 'ignore', detached: true }).unref();
    } else {
      spawn('xdg-open', [targetUrl], { stdio: 'ignore', detached: true }).unref();
    }
  } catch {
    // Browser open failed — not critical, user has the URL
  }
}

// ── Graceful shutdown ──────────────────────────────────
server.on('close', (code) => {
  clearInterval(checkReady);
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
