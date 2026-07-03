import type { Metadata } from 'next';
import { Geist, Geist_Mono, Nunito_Sans } from 'next/font/google';
import './global.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
// The brand heading face is Avenir Next, which isn't web-available — headings
// were silently falling back to Geist. Nunito Sans is the closest free match
// (geometric humanist) and was already in the fallback stack; bundle it so
// headings render consistently everywhere.
const nunitoSans = Nunito_Sans({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
});

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

// Apply the saved (or system) theme before first paint, so there's no flash of
// the wrong theme. Mirrors the logic in <ThemeToggle>.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nunitoSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
