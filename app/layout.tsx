import type { Metadata } from 'next';
import './globals.css';
import { initializeDb, queryOne } from '@/lib/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import UpdateBanner from '@/components/shared/UpdateBanner';
import ShortcutsOverlay from '@/components/shared/ShortcutsOverlay';
import ScrollToTop from '@/components/ui/ScrollToTop';
import ServiceWorkerRegistration from '@/components/ui/ServiceWorkerRegistration';
import { ToastProvider } from '@/components/ui/Toast';

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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-nav">Skip to content</a>
        <ToastProvider>
          {children}
          <UpdateBanner />
          <ShortcutsOverlay />
          <ScrollToTop />
          <ServiceWorkerRegistration />
        </ToastProvider>
      </body>
    </html>
  );
}

