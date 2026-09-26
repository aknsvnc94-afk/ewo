'use client';
import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const dolgu = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + dolgu).replace(/-/g, '+').replace(/_/g, '/');
  const ham = window.atob(base64);
  const dizi = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) dizi[i] = ham.charCodeAt(i);
  return dizi;
}

type Durum = 'kontrol_ediliyor' | 'desteklenmiyor' | 'kapali' | 'acik' | 'isleniyor' | 'reddedildi';

export default function BildirimButonu() {
  const [durum, setDurum] = useState<Durum>('kontrol_ediliyor');

  useEffect(() => {
    async function kontrolEt() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setDurum('desteklenmiyor');
        return;
      }
      if (Notification.permission === 'denied') {
        setDurum('reddedildi');
        return;
      }
      try {
        const kayit = await navigator.serviceWorker.register('/sw.js');
        const abonelik = await kayit.pushManager.getSubscription();
        setDurum(abonelik ? 'acik' : 'kapali');
      } catch {
        setDurum('kapali');
      }
    }
    kontrolEt();
  }, []);

  async function bildirimleriAc() {
    setDurum('isleniyor');
    try {
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') {
        setDurum(izin === 'denied' ? 'reddedildi' : 'kapali');
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) { setDurum('desteklenmiyor'); return; }

      const kayit = await navigator.serviceWorker.ready;
      const abonelik = await kayit.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch('/api/push/abone-ol', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: abonelik.toJSON() }),
      });
      setDurum(res.ok ? 'acik' : 'kapali');
    } catch (err) {
      console.error('Bildirim aboneliği hatası:', err);
      setDurum('kapali');
    }
  }

  if (durum === 'kontrol_ediliyor' || durum === 'desteklenmiyor') return null;

  if (durum === 'acik') {
    return <div className="panel-menu-oge" style={{ cursor: 'default', color: 'var(--ok, #22c55e)' }}>🔔 Bildirimler Açık</div>;
  }
  if (durum === 'reddedildi') {
    return (
      <div className="panel-menu-oge muted" style={{ cursor: 'default', fontSize: 12.5 }}>
        Bildirimler engellenmiş (tarayıcı ayarlarından açabilirsiniz)
      </div>
    );
  }
  return (
    <button className="panel-menu-oge" onClick={bildirimleriAc} disabled={durum === 'isleniyor'} style={{ width: '100%' }}>
      🔔 {durum === 'isleniyor' ? 'Açılıyor...' : 'Bildirimleri Aç'}
    </button>
  );
}
