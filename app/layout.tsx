// File: app/layout.tsx

import './globals.css';

// Initialize the Google APIs keep-alive agent globally
// This MUST be imported before any other files that use googleapis
import '@/lib/google-http';

import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
