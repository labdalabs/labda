import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './global.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://labda.app'),
  title: 'Labda',
  description: 'A sandbox for bioscience. Currently incubating.',
  openGraph: {
    title: 'Labda',
    description: 'A sandbox for bioscience. Currently incubating.',
    url: 'https://labda.app',
    siteName: 'Labda',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/preview.png',
        width: 640,
        height: 405,
        alt: 'Labda',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Labda',
    description: 'A sandbox for bioscience. Currently incubating.',
    images: ['/preview.png'],
  },
  icons: {
    icon: '/favicon_xs.png',
    apple: '/favicon_xs.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
