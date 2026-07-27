import type { Metadata } from 'next';
import './globals.css';
import { initializeDb, queryOne } from '@/lib/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import UpdateBanner from '@/components/shared/UpdateBanner';
import ShortcutsOverlay from '@/components/shared/ShortcutsOverlay';
import ScrollToTop from '@/components/ui/ScrollToTop';
import BackToTop from '@/components/shared/BackToTop';
import ServiceWorkerRegistration from '@/components/ui/ServiceWorkerRegistration';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: {
    template: '%s | NexAnime',
    default: 'NexAnime — Your Anime, Your Way',
  },
  description: 'Self-hosted anime streaming and tracking app. Browse, watch, track progress, maintain a watchlist, and get notified about new episodes.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://anime.hackers-reality.com/',
    siteName: 'NexAnime',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://anime.hackers-reality.com'}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'NexAnime - Anime Tracking and Streaming Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@hackersreality',
    title: 'NexAnime — Your Anime, Your Way',
    description: 'Self-hosted anime streaming and tracking app.',
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || 'https://anime.hackers-reality.com'}/og-image.png`],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NexAnime" />
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
          <BackToTop />
          <ServiceWorkerRegistration />
        </ToastProvider>
      </body>
    </html>
  );
}

