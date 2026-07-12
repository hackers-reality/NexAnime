const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DB_PATH = path.join(__dirname, 'nexanime.db');

function deleteDb() {
  if (fs.existsSync(DB_PATH)) {
    console.log('Deleting existing nexanime.db...');
    try {
      fs.unlinkSync(DB_PATH);
    } catch (e) {
      console.log('Could not delete DB directly, might be locked. Wiping contents...', e.message);
      // Fallback: write empty file
      fs.writeFileSync(DB_PATH, '');
    }
  }
}

async function runTest() {
  deleteDb();

  console.log('Starting next server on port 3005...');
  const server = spawn('cmd.exe', ['/c', 'npx next start -p 3005'], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  server.stdout.on('data', (data) => {
    console.log(`[Server]: ${data.toString().trim()}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data.toString().trim()}`);
  });

  // Wait 12 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 12000));

  try {
    console.log('Test 1: Requesting "/" from fresh DB...');
    const res1 = await fetch('http://localhost:3005/', { redirect: 'manual' });
    console.log('Response status:', res1.status);
    console.log('Redirect Location:', res1.headers.get('location'));
    if (res1.status === 307 && res1.headers.get('location').endsWith('/onboarding')) {
      console.log('✅ Test 1 Passed: Redirected to /onboarding');
    } else {
      throw new Error(`Test 1 Failed: Status ${res1.status}, Location ${res1.headers.get('location')}`);
    }

    console.log('Test 2: Requesting "/onboarding" from fresh DB...');
    const res2 = await fetch('http://localhost:3005/onboarding', { redirect: 'manual' });
    console.log('Response status:', res2.status);
    if (res2.status === 200) {
      console.log('✅ Test 2 Passed: Onboarding page loads');
    } else {
      throw new Error(`Test 2 Failed: Status ${res2.status}`);
    }

    console.log('Test 3: Completing onboarding via /api/profile...');
    const res3 = await fetch('http://localhost:3005/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'TestUser',
        pronouns: 'he/him',
        aboutMe: 'Software developer',
        avatarCharId: 10
      })
    });
    const data3 = await res3.json();
    console.log('Profile update response:', data3);
    if (res3.status === 200 && data3.success) {
      console.log('✅ Test 3 Passed: Profile saved and marked onboarded');
    } else {
      throw new Error(`Test 3 Failed: Status ${res3.status}, body ${JSON.stringify(data3)}`);
    }

    console.log('Test 4: Requesting "/" after onboarding...');
    const res4 = await fetch('http://localhost:3005/', { redirect: 'manual' });
    console.log('Response status:', res4.status);
    if (res4.status === 200) {
      console.log('✅ Test 4 Passed: Allowed access to "/"');
    } else {
      throw new Error(`Test 4 Failed: Status ${res4.status}, Location ${res4.headers.get('location')}`);
    }

    console.log('Test 5: Requesting "/onboarding" after onboarding...');
    const res5 = await fetch('http://localhost:3005/onboarding', { redirect: 'manual' });
    console.log('Response status:', res5.status);
    console.log('Redirect Location:', res5.headers.get('location'));
    if (res5.status === 307 && res5.headers.get('location').endsWith('/')) {
      console.log('✅ Test 5 Passed: Onboarding redirects back to "/"');
    } else {
      throw new Error(`Test 5 Failed: Status ${res5.status}, Location ${res5.headers.get('location')}`);
    }

    console.log('🎉 ALL ONBOARDING REDIRECT TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test execution failed:', err);
  } finally {
    console.log('Stopping server...');
    server.kill();
    // Also kill tasks running on port 3005 just in case
    const { execSync } = require('child_process');
    try {
      const output = execSync('netstat -ano | findstr :3005').toString();
      const pid = output.trim().split(/\s+/).pop();
      if (pid) {
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`Killed remaining server process ${pid}`);
      }
    } catch (e) {}
    process.exit(0);
  }
}

runTest();
