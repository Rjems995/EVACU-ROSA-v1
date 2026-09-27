import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/language-provider';
export const metadata: Metadata = {
  title: 'EVACU-ROSA · Find your way to safety',
  description: 'Risk-aware evacuation routes and shelter information for Santa Rosa City, Laguna.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#8b0000' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === 'development' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
            (async () => {
              if (!('serviceWorker' in navigator)) return;
              try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                const ours = registrations.filter(r => [r.active, r.waiting, r.installing].some(w => w && new URL(w.scriptURL).pathname === '/sw.js'));
                const controlled = navigator.serviceWorker.controller && new URL(navigator.serviceWorker.controller.scriptURL).pathname === '/sw.js';
                await Promise.all(ours.map(r => r.unregister()));
                const keys = await caches.keys();
                await Promise.all(keys.filter(k => k.startsWith('evacu-rosa-shell-')).map(k => caches.delete(k)));
                if (controlled) location.reload();
              } catch (error) { console.warn('Development offline-cache cleanup failed.', error); }
            })();
          `,
            }}
          />
        )}
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
