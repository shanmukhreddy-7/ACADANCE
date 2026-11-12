import type { Metadata } from 'next';
import './globals.css';
import InstallApp from '@/components/install-app';
export const metadata: Metadata = {
  title: 'Acadence — A little more clarity.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/brand/icon-192-v2.png' },
  description:
    'Attendance, assessments and your academic day. A considered workspace for students and professors.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser helpers may inject attributes on body before React hydrates. */}
      <body suppressHydrationWarning>
        <InstallApp />
        {children}
      </body>
    </html>
  );
}
