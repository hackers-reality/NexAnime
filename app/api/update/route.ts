// NexAnime — Update API route
// GET: Check for updates from GitHub
// POST: Execute update (git pull + npm install + rebuild)

import { NextRequest, NextResponse } from 'next/server';
import { getLocalCommitSha, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } from '@/lib/version';
import { execSync, spawn } from 'child_process';
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

// GET — Check for available updates
export async function GET() {
  try {
    const localSha = getLocalCommitSha();

    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'NexAnime-Updater',
      },
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

    return NextResponse.json({
      updateAvailable: !isUpToDate,
      localSha,
      remoteSha,
      remoteMessage: data.commit.message.split('\n')[0],
      remoteDate: data.commit.author.date,
      remoteAuthor: data.commit.author.name,
      commitUrl: data.html_url,
      currentVersion: JSON.parse(readFileSync(/* turbopackIgnore: true */ path.resolve(process.cwd(), 'package.json'), 'utf-8')).version,
    });
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
