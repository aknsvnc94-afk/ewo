import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

let vapidAyarlandi = false;
function vapidHazirla() {
  if (vapidAyarlandi) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error('VAPID anahtarları tanımlı değil (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:bildirim@example.com',
    publicKey,
    privateKey
  );
  vapidAyarlandi = true;
}

type BildirimIcerik = { baslik: string; govde: string; url?: string };

// Verilen personel id'lerine (aynı fabrikadaki abonelikleri üzerinden) push bildirimi gönderir.
// Süresi dolmuş/geçersiz abonelikleri (410 Gone) otomatik olarak veritabanından siler.
export async function personellereBildirimGonder(personelIdleri: string[], icerik: BildirimIcerik) {
  if (personelIdleri.length === 0) return;
  vapidHazirla();

  const supabase = supabaseAdmin();
  const { data: abonelikler } = await supabase
    .from('push_abonelikleri')
    .select('id, endpoint, p256dh, auth')
    .in('personel_id', personelIdleri);

  if (!abonelikler || abonelikler.length === 0) return;

  const payload = JSON.stringify({
    baslik: icerik.baslik,
    govde: icerik.govde,
    url: icerik.url || '/panel',
  });

  await Promise.all(
    abonelikler.map(async (abonelik) => {
      try {
        await webpush.sendNotification(
          { endpoint: abonelik.endpoint, keys: { p256dh: abonelik.p256dh, auth: abonelik.auth } },
          payload
        );
      } catch (err: any) {
        // 404/410: abonelik artık geçersiz (kullanıcı bildirimi kapatmış/uygulamayı silmiş) — temizle.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_abonelikleri').delete().eq('id', abonelik.id);
        } else {
          console.error('Push gönderim hatası:', err?.message || err);
        }
      }
    })
  );
}
