// Bu dosya tarayıcı tarafından arka planda çalıştırılır — uygulama kapalı
// olsa bile push bildirimini yakalayıp göstermekten sorumludur.

self.addEventListener('push', (event) => {
  let veri = {};
  try {
    veri = event.data ? event.data.json() : {};
  } catch {
    veri = { baslik: 'Bildirim', govde: event.data ? event.data.text() : '' };
  }

  const baslik = veri.baslik || 'Bakım Yönetim Sistemi';
  const secenekler = {
    body: veri.govde || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: veri.url || '/panel' },
  };

  event.waitUntil(self.registration.showNotification(baslik, secenekler));
});

// Bildirime tıklanınca, ilgili sayfayı açık bir sekmede varsa ona odaklan,
// yoksa yeni bir sekmede aç.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hedefUrl = event.notification.data?.url || '/panel';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((istemciler) => {
      for (const istemci of istemciler) {
        if (istemci.url.includes(hedefUrl) && 'focus' in istemci) return istemci.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(hedefUrl);
    })
  );
});
