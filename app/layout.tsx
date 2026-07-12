import type { Metadata } from 'next';
import './globals.css';
import { initializeDb, queryOne } from '@/lib/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'NexAnime — Your Anime, Your Way',
  description:
    'Self-hosted anime streaming and tracking app. Browse, watch, track progress, maintain a watchlist, and get notified about new episodes.',
};

// Initialize the database on server startup
const dbInitPromise = initializeDb().catch((err) => {
  console.error('Failed to initialize database:', err);
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Ensure DB is initialized before rendering
  await dbInitPromise;

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // Check onboarding status
  const profile = await queryOne<{ onboarded_at: string | null }>(
    'SELECT onboarded_at FROM profile WHERE id = 1'
  );

  const isOnboarded = !!(profile && profile.onboarded_at);

  if (!isOnboarded && pathname !== '/onboarding') {
    redirect('/onboarding');
  }

  if (isOnboarded && pathname === '/onboarding') {
    redirect('/');
  }

  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

