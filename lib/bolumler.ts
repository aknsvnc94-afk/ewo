export type BolumId = 'bakim' | 'kalite' | 'uretim';

export type Modul = {
  ad: string;
  aciklama: string;
  yol: string;
  ikon: string;
  hazir: boolean;
  // Bu modülü yalnızca admin/superadmin görebilsin mi?
  sadeceAdmin?: boolean;
};

export type Bolum = {
  id: BolumId;
  ad: string;
  altBaslik: string;
  ikon: string;
  moduller: Modul[];
};

export const BOLUMLER: Bolum[] = [
  {
    id: 'bakim',
    ad: 'Bakım',
    altBaslik: 'Arıza, iş emri ve malzeme süreçleri',
    ikon: 'tool',
    moduller: [
      { ad: 'EWO Arızalar', aciklama: 'Arıza kayıtları ve analiz formu', yol: '/admin/ewo-arizalar', ikon: 'alert', hazir: true, sadeceAdmin: true },
      { ad: 'Bana Atananlar', aciklama: 'Size atanan arıza kayıtları', yol: '/personel', ikon: 'inbox', hazir: true },
      { ad: 'İş Emirleri', aciklama: 'Günlük açık iş emri takibi', yol: '/admin/is-emirleri', ikon: 'clipboard', hazir: true, sadeceAdmin: true },
      { ad: 'Aksiyonlar', aciklama: 'Önlem ve termin takibi', yol: '/admin/aksiyonlar', ikon: 'check', hazir: true, sadeceAdmin: true },
      { ad: 'Analiz / Pareto', aciklama: 'Kök neden ve Pareto analizi', yol: '/admin/analiz', ikon: 'chart', hazir: true, sadeceAdmin: true },
      { ad: 'Performans', aciklama: 'MTTR, MTBF, MSBF göstergeleri', yol: '/admin/performans', ikon: 'gauge', hazir: true, sadeceAdmin: true },
      { ad: 'Siparişler', aciklama: 'Satınalma talep ve malzeme takibi', yol: '/admin/siparisler', ikon: 'package', hazir: true, sadeceAdmin: true },
      { ad: 'Makineler', aciklama: 'Makine ve yedek parça listesi', yol: '/admin/makineler', ikon: 'settings', hazir: true, sadeceAdmin: true },
    ],
  },
  {
    id: 'kalite',
    ad: 'Kalite',
    altBaslik: 'Uygunsuzluk, DÖF ve kalite kontrol süreçleri',
    ikon: 'shield',
    moduller: [
      { ad: 'Uygunsuzluklar', aciklama: 'Hata ve hurda/fire kayıtları', yol: '/kalite/uygunsuzluklar', ikon: 'alert', hazir: false },
      { ad: 'DÖF / 8D', aciklama: 'Düzeltici önleyici faaliyetler', yol: '/kalite/dof', ikon: 'clipboard', hazir: false },
      { ad: 'Müşteri Şikayetleri', aciklama: 'Şikayet kaydı ve takibi', yol: '/kalite/sikayetler', ikon: 'inbox', hazir: false },
      { ad: 'Kalibrasyon', aciklama: 'Ölçüm cihazı kalibrasyon takibi', yol: '/kalite/kalibrasyon', ikon: 'gauge', hazir: false },
    ],
  },
  {
    id: 'uretim',
    ad: 'Üretim',
    altBaslik: 'Üretim operasyonları ve takibi',
    ikon: 'factory',
    moduller: [
      { ad: 'Üretim Takibi', aciklama: 'Vardiya ve üretim kayıtları', yol: '/uretim/takip', ikon: 'chart', hazir: false },
      { ad: 'Duruş Analizi', aciklama: 'Duruş nedenleri ve süreleri', yol: '/uretim/duruslar', ikon: 'clock', hazir: false },
    ],
  },
];

export function bolumBul(id: string | null | undefined): Bolum | undefined {
  return BOLUMLER.find((b) => b.id === id);
}

// Yetki kuralı: herkes tüm bölümleri GÖRÜNTÜLEYEBİLİR, ancak yalnızca kendi
// bölümünde işlem yapabilir. Süper admin her bölümde işlem yapabilir.
export function bolumdeIslemYapabilir(
  session: { rol: string; bolum?: string | null } | null,
  bolumId: BolumId
): boolean {
  if (!session) return false;
  if (session.rol === 'superadmin') return true;
  return session.bolum === bolumId;
}
