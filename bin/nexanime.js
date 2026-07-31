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
const buildIdFile = path.join(nextDir, 'BUILD_ID');
const devDir = path.join(nextDir, 'dev');

// Detect stale dev artifacts — they corrupt production builds
const hasStaleDev = fs.existsSync(devDir);
const hasBuild = fs.existsSync(nextDir) && fs.existsSync(buildIdFile);

if (!hasBuild || hasStaleDev) {
  if (hasStaleDev) {
    console.log('\n  Stale dev cache detected — cleaning before build...\n');
    try { fs.rmSync(nextDir, { recursive: true, force: true }); } catch {}
  } else {
    console.log('\n  Building NexAnime...\n');
  }
  try {
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
  } catch {
    console.error('\n  Build failed. Run "npm run build" manually and try again.\n');
    process.exit(1);
  }
  if (!fs.existsSync(buildIdFile)) {
    console.error('\n  Build completed but no production build was found.\n');
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
let ready = false; // one-shot guard — only the FIRST success proceeds

function checkServer() {
  if (ready) return; // another callback already handled it
  http
    .get(url, (res) => {
      res.resume(); // drain response body
      if (ready) return; // double-check after async gap
      if (res.statusCode) {
        ready = true; // atomically mark as ready — all other callbacks become no-ops
        console.log(`\n  NexAnime is running at ${url}\n`);
        openBrowser(url);
      }
    })
    .on('error', () => {
      if (ready) return;
      if (++attempts > maxAttempts) {
        ready = true; // stop all further checks
        console.log(`\n  Server may still be starting. Open ${url} in your browser.\n`);
        return;
      }
      setTimeout(checkServer, 1000);
    });
}

// Start the first check after 1s — no overlap since each check completes before scheduling next
setTimeout(checkServer, 1000);

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
  ready = true; // stop any pending readiness checks
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
