import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Inria_Serif } from 'next/font/google';
import NavBar from '@/components/NavBar';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const inriaSerif = Inria_Serif({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-inria',
});

export const metadata: Metadata = {
  title: 'Commercial Dashboard | Forward Institute',
  description: 'Forward Institute Commercial Dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${inriaSerif.variable} antialiased`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
