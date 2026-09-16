import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitAgent',
  description: 'AI-native Git platform for governed agentic software development',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
