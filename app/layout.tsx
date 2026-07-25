import './globals.css';

export const metadata = {
  title: 'Bakım Yönetim Sistemi',
  description: 'Çoklu fabrika bakım arıza, iş emri ve sipariş takip platformu',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
