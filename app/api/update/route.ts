// NexAnime — Update API route
// GET: Check for updates from GitHub
// POST: Execute update (git pull + npm install + rebuild)

import { NextRequest, NextResponse } from 'next/server';
import { getLocalCommitSha, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } from '@/lib/version';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`;

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

let _pkgVersion: string | null = null;
function getPackageVersion(): string {
  if (_pkgVersion !== null) return _pkgVersion;
  try {
    _pkgVersion = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')).version;
  } catch {
    _pkgVersion = '0.0.0';
  }
  return _pkgVersion!;
}

let updateCache: { data: any; expiry: number } | null = null;

// GET — Check for available updates
export async function GET() {
  try {
    if (updateCache && Date.now() < updateCache.expiry) {
      return NextResponse.json(updateCache.data);
    }

    const localSha = getLocalCommitSha();

    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'NexAnime-Updater',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return NextResponse.json({
        updateAvailable: false,
        error: `GitHub API error: ${response.status}`,
        localSha,
      });
    }

    const data: GitHubCommit = await response.json();
    const remoteSha = data.sha;
    const isUpToDate = localSha === remoteSha;

    const result = {
      updateAvailable: !isUpToDate,
      localSha,
      remoteSha,
      remoteMessage: data.commit.message.split('\n')[0],
      remoteDate: data.commit.author.date,
      remoteAuthor: data.commit.author.name,
      commitUrl: data.html_url,
      currentVersion: getPackageVersion(),
    };

    updateCache = { data: result, expiry: Date.now() + 300_000 };
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        updateAvailable: false,
        error: error instanceof Error ? error.message : 'Failed to check for updates',
        localSha: getLocalCommitSha(),
      },
      { status: 500 }
    );
  }
}

// POST — Execute the update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun } = body as { dryRun?: boolean };

    const cwd = path.resolve(process.cwd());

    if (dryRun) {
      // Just report what would happen
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Dry run complete. Update would pull latest changes and rebuild.',
      });
    }

    // Step 1: Stash any local changes (protect user data)
    try {
      execSync('git stash', { cwd, encoding: 'utf-8', timeout: 10000 });
    } catch {
      // Ignore stash errors (no changes to stash)
    }

    // Step 2: Pull latest from GitHub
    const pullOutput = execSync('git pull origin ' + GITHUB_BRANCH, {
      cwd,
      encoding: 'utf-8',
      timeout: 60000,
    });

    // Step 3: Install any new dependencies
    execSync('npm install --production=false', {
      cwd,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe',
    });

    // Step 4: Build the app
    execSync('npm run build', {
      cwd,
      encoding: 'utf-8',
      timeout: 180000,
      stdio: 'pipe',
    });

    // Step 5: Pop the stash to restore any local changes
    try {
      execSync('git stash pop', { cwd, encoding: 'utf-8', timeout: 10000 });
    } catch {
      // Ignore stash pop errors
    }

    const newSha = getLocalCommitSha();

    return NextResponse.json({
      success: true,
      message: 'Update applied successfully! Restart the app to use the new version.',
      newSha,
      pullSummary: pullOutput.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed',
      },
      { status: 500 }
    );
  }
}
