// NexAnime — Version tracking
// Stores the current build commit SHA for update comparison

import { execSync } from 'child_process';

let _localSha: string | null = null;

export function getLocalCommitSha(): string {
  if (_localSha) return _localSha;
  try {
    _localSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    _localSha = 'unknown';
  }
  return _localSha;
}

export function getShortSha(): string {
  const sha = getLocalCommitSha();
  return sha === 'unknown' ? 'unknown' : sha.substring(0, 7);
}

// GitHub config — update these to your repo
export const GITHUB_OWNER = 'hackers-reality';
export const GITHUB_REPO = 'NexAnime';
export const GITHUB_BRANCH = 'main';
