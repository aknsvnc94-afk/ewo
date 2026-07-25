import './globals.css';

export const metadata = {
  title: 'Bakım Yönetim Sistemi',
  description: 'Çoklu fabrika bakım arıza, iş emri ve sipariş takip platformu',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  // iOS Safari, manifest.json'daki display:standalone'ı bazı sürümlerde
  // görmezden gelir; bu meta etiketler "Ana Ekrana Ekle" ile açıldığında
  // Safari çerçevesi olmadan gerçek uygulama gibi açılmasını garantiler.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bakım Sistemi',
  },
};

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
