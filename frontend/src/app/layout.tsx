import type { Metadata } from 'next';
import { Fira_Sans } from 'next/font/google';
import './globals.css';

const firaSans = Fira_Sans({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fira-sans'
});

export const metadata: Metadata = {
  title: 'XDC Privacy - Confidential Transactions',
  description: 'Enterprise-grade confidential transactions on XDC Network. Privacy-preserving with on-chain commitments.',
  icons: {
    icon: '/xdc-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${firaSans.className} antialiased`}>{children}</body>
    </html>
  );
}
