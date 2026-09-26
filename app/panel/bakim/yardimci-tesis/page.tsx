'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type Ekipman = {
  id: string; ad: string; tur: string; kontrol_edilebilir: boolean;
  birim: string | null; setpoint_min: number | null; setpoint_max: number | null;
  cihaz: { id: string; ad: string; aktif: boolean; son_gorulme: string | null } | null;
  son_olcum: { deger: number; durum: string | null; olcum_zamani: string } | null;
  cevrimici: boolean;
};

const TUR_ADLARI: Record<string, string> = {
  sicaklik: 'Sıcaklık', pompa: 'Pompa', kompresor: 'Kompresör', chiller: 'Chiller', diger: 'Diğer',
};
const TUR_SIRASI = ['sicaklik', 'pompa', 'kompresor', 'chiller', 'diger'];

function zamanFarkiYaz(iso: string | null) {
  if (!iso) return 'hiç';
  const fark = Date.now() - new Date(iso).getTime();
  const sn = Math.floor(fark / 1000);
  if (sn < 60) return `${sn} sn önce`;
  if (sn < 3600) return `${Math.floor(sn / 60)} dk önce`;
  return `${Math.floor(sn / 3600)} sa önce`;
}

export default function YardimciTesisPage() {
  const [ekipmanlar, setEkipmanlar] = useState<Ekipman[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islemdeId, setIslemdeId] = useState<string | null>(null);
  const [hata, setHata] = useState('');
  const [onayModal, setOnayModal] = useState<{ ekipman: Ekipman; hedefDurum: 0 | 1 } | null>(null);
  const [setpointDuzenleId, setSetpointDuzenleId] = useState<string | null>(null);
  const [setpointDeger, setSetpointDeger] = useState('');

  const verileriGetir = useCallback(async () => {
    const res = await fetch('/api/yardimci-tesis/durum');
    const data = await res.json();
    if (res.ok) setEkipmanlar(data.ekipmanlar || []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    verileriGetir();
    const interval = setInterval(verileriGetir, 15000); // 15 saniyede bir otomatik yenile
    return () => clearInterval(interval);
  }, [verileriGetir]);

  async function komutGonder(ekipman_id: string, komut_tipi: 'ac_kapat' | 'setpoint', istenen_deger: number) {
    setIslemdeId(ekipman_id);
    setHata('');
    try {
      const res = await fetch('/api/yardimci-tesis/komut', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ekipman_id, komut_tipi, istenen_deger }),
      });
      const data = await res.json();
      if (!res.ok) { setHata(data.error || 'Komut gönderilemedi'); return; }
      setTimeout(verileriGetir, 2000); // köprünün uygulaması için kısa bekleme sonrası tazele
    } finally {
      setIslemdeId(null);
      setOnayModal(null);
      setSetpointDuzenleId(null);
    }
  }

  const gruplar = TUR_SIRASI
    .map((tur) => ({ tur, liste: ekipmanlar.filter((e) => e.tur === tur) }))
    .filter((g) => g.liste.length > 0);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Yardımcı Tesis Kontrol</h1>
          <p className="muted">AnKA GLC üzerinden sıcaklık, pompa, kompresör ve chiller izleme/kontrol</p>
        </div>
        <Link href="/panel/bakim/yardimci-tesis/ayarlar"><button className="secondary">Cihaz / Ekipman Ayarları</button></Link>
      </div>

      {hata && <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{hata}</div>}

      {yukleniyor ? (
        <p className="muted">Yükleniyor...</p>
      ) : ekipmanlar.length === 0 ? (
        <div className="card">
          <p className="muted">Henüz hiç ekipman tanımlanmamış.</p>
          <Link href="/panel/bakim/yardimci-tesis/ayarlar"><button>Cihaz ve Ekipman Ekle</button></Link>
        </div>
      ) : (
        gruplar.map((g) => (
          <div key={g.tur} style={{ marginBottom: 20 }}>
            <h3>{TUR_ADLARI[g.tur]}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {g.liste.map((e) => {
                const acikMi = e.son_olcum?.deger === 1;
                return (
                  <div key={e.id} className="card" style={{ margin: 0, opacity: e.cevrimici ? 1 : 0.6 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600 }}>{e.ad}</div>
                      <span className={e.cevrimici ? 'status-Tamamlandı' : 'status-İptal'} style={{ fontSize: 11.5 }}>
                        {e.cevrimici ? '● Çevrimiçi' : '● Bağlantı Yok'}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{e.cihaz?.ad}</div>

                    {e.son_olcum ? (
                      <>
                        <div style={{ fontSize: 26, fontWeight: 700 }}>
                          {e.tur === 'sicaklik' || (!e.kontrol_edilebilir && e.tur !== 'pompa' && e.tur !== 'kompresor' && e.tur !== 'chiller')
                            ? `${e.son_olcum.deger}${e.birim ? ' ' + e.birim : ''}`
                            : acikMi ? 'Açık' : 'Kapalı'}
                        </div>
                        <div className="muted" style={{ fontSize: 11 }}>{zamanFarkiYaz(e.son_olcum.olcum_zamani)} güncellendi</div>
                      </>
                    ) : (
                      <p className="muted" style={{ fontSize: 13 }}>Henüz ölçüm yok</p>
                    )}

                    {e.kontrol_edilebilir && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(e.tur === 'pompa' || e.tur === 'kompresor' || e.tur === 'chiller') && (
                          <button
                            className={acikMi ? 'danger' : ''}
                            disabled={islemdeId === e.id || !e.cevrimici}
                            onClick={() => setOnayModal({ ekipman: e, hedefDurum: acikMi ? 0 : 1 })}
                          >
                            {acikMi ? 'Kapat' : 'Aç'}
                          </button>
                        )}
                        {e.setpoint_min !== null && e.setpoint_max !== null && (
                          setpointDuzenleId === e.id ? (
                            <div className="row">
                              <input
                                type="number" value={setpointDeger} onChange={(ev) => setSetpointDeger(ev.target.value)}
                                min={e.setpoint_min} max={e.setpoint_max} style={{ width: 80 }}
                              />
                              <button
                                disabled={islemdeId === e.id}
                                onClick={() => setpointDeger !== '' && komutGonder(e.id, 'setpoint', Number(setpointDeger))}
                              >Gönder</button>
                              <button className="secondary" onClick={() => setSetpointDuzenleId(null)}>Vazgeç</button>
                            </div>
                          ) : (
                            <button className="secondary" disabled={!e.cevrimici} onClick={() => { setSetpointDuzenleId(e.id); setSetpointDeger(''); }}>
                              Setpoint Değiştir
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {onayModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 380, margin: 0 }}>
            <h3 style={{ marginTop: 0 }}>Komutu Onayla</h3>
            <p>
              <strong>{onayModal.ekipman.ad}</strong> ekipmanını{' '}
              <strong style={{ color: onayModal.hedefDurum ? 'var(--ok)' : 'var(--danger)' }}>
                {onayModal.hedefDurum ? 'AÇMAK' : 'KAPATMAK'}
              </strong> üzeresiniz. Bu, gerçek fiziksel ekipmanı etkileyecektir. Emin misiniz?
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => setOnayModal(null)}>Vazgeç</button>
              <button
                className={onayModal.hedefDurum ? '' : 'danger'}
                disabled={islemdeId === onayModal.ekipman.id}
                onClick={() => komutGonder(onayModal.ekipman.id, 'ac_kapat', onayModal.hedefDurum)}
              >
                {islemdeId === onayModal.ekipman.id ? 'Gönderiliyor...' : 'Evet, Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
