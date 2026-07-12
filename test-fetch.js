const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'nexanime.db');

async function testFetch() {
  try {
    console.log('Test 1: Requesting "/" from fresh DB...');
    const res1 = await fetch('http://127.0.0.1:3005/', { redirect: 'manual' });
    console.log('Response status:', res1.status);
    console.log('Redirect Location:', res1.headers.get('location'));

    console.log('Test 2: Requesting "/onboarding"...');
    const res2 = await fetch('http://127.0.0.1:3005/onboarding', { redirect: 'manual' });
    console.log('Response status:', res2.status);

    console.log('Test 3: Completing onboarding...');
    const res3 = await fetch('http://127.0.0.1:3005/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'TestUser',
        pronouns: 'he/him',
        aboutMe: 'Software developer',
        avatarCharId: 10
      })
    });
    console.log('Profile POST status:', res3.status);
    console.log('Profile POST body:', await res3.json());

    console.log('Test 4: Requesting "/" after onboarding...');
    const res4 = await fetch('http://127.0.0.1:3005/', { redirect: 'manual' });
    console.log('Response status:', res4.status);
    console.log('Redirect Location:', res4.headers.get('location'));

    console.log('Test 5: Requesting "/onboarding" after onboarding...');
    const res5 = await fetch('http://127.0.0.1:3005/onboarding', { redirect: 'manual' });
    console.log('Response status:', res5.status);
    console.log('Redirect Location:', res5.headers.get('location'));

  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testFetch();
