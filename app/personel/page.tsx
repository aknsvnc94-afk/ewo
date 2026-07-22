'use client';
import { useEffect, useState } from 'react';

type Kayit = {
  id: string;
  tezgah: string;
  kategori: 'MA' | 'BA' | 'KA' | 'RA';
  durus_adi: string;
  baslangic: string;
  sure: string;
  aciklama: string;
  aksiyon: string | null;
  hedef_tarih: string | null;
  tamamlanma_durumu: string;
  kok_neden_turu: string | null;
};

const DURUM_SECENEKLERI = ['Beklemede', 'Devam Ediyor', 'Tamamlandı', 'İptal'];

export default function PersonelPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [acikId, setAcikId] = useState<string | null>(null);
  const [taslak, setTaslak] = useState<Record<string, Partial<Kayit>>>({});
  const [kaydediliyor, setKaydediliyor] = useState<string | null>(null);

  async function verileriGetir() {
    const res = await fetch('/api/records');
    const data = await res.json();
    setKayitlar(data.kayitlar || []);
  }

  useEffect(() => { verileriGetir(); }, []);

  function alaniGuncelle(id: string, alan: keyof Kayit, deger: any) {
    setTaslak((prev) => ({ ...prev, [id]: { ...prev[id], [alan]: deger } }));
  }

  function deger(k: Kayit, alan: keyof Kayit) {
    return taslak[k.id]?.[alan] ?? k[alan] ?? '';
  }

  async function kaydet(k: Kayit) {
    setKaydediliyor(k.id);
    const t = taslak[k.id] || {};
    try {
      await fetch('/api/update-record', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: k.id,
          aksiyon: t.aksiyon ?? k.aksiyon,
          hedef_tarih: t.hedef_tarih ?? k.hedef_tarih,
          tamamlanma_durumu: t.tamamlanma_durumu ?? k.tamamlanma_durumu,
          kok_neden_turu: t.kok_neden_turu ?? k.kok_neden_turu,
        }),
      });
      await verileriGetir();
      setAcikId(null);
    } finally {
      setKaydediliyor(null);
    }
  }

  return (
    <div className="container">
      <h1>Bana Atanan Arızalar</h1>
      <div className="record-list">
        {kayitlar.length === 0 && <p className="muted">Şu anda size atanmış kayıt yok.</p>}
        {kayitlar.map((k) => (
          <div key={k.id} className="record-item">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{k.tezgah}</strong>
              <span className={`badge badge-${k.kategori}`}>{k.kategori}</span>
            </div>
            <div className="muted">{k.durus_adi} · {k.baslangic ? new Date(k.baslangic).toLocaleString('tr-TR') : '-'} · {k.sure}</div>
            {k.aciklama && <div style={{ marginTop: 6 }}>{k.aciklama}</div>}
            <div className={`status-${k.tamamlanma_durumu?.replace(' ', '')}`} style={{ marginTop: 6, fontWeight: 600 }}>
              {k.tamamlanma_durumu}
            </div>

            {acikId === k.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                <label className="muted">Aksiyon
                  <textarea
                    value={deger(k, 'aksiyon') as string}
                    onChange={(e) => alaniGuncelle(k.id, 'aksiyon', e.target.value)}
                    rows={3}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
                <label className="muted">Kök Neden Türü
                  <input
                    value={deger(k, 'kok_neden_turu') as string}
                    onChange={(e) => alaniGuncelle(k.id, 'kok_neden_turu', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
                <label className="muted">Hedef Tarih
                  <input
                    type="date"
                    value={(deger(k, 'hedef_tarih') as string) || ''}
                    onChange={(e) => alaniGuncelle(k.id, 'hedef_tarih', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </label>
                <label className="muted">Tamamlanma Durumu
                  <select
                    value={deger(k, 'tamamlanma_durumu') as string}
                    onChange={(e) => alaniGuncelle(k.id, 'tamamlanma_durumu', e.target.value)}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    {DURUM_SECENEKLERI.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <div className="row">
                  <button onClick={() => kaydet(k)} disabled={kaydediliyor === k.id}>
                    {kaydediliyor === k.id ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button className="secondary" onClick={() => setAcikId(null)}>Vazgeç</button>
                </div>
              </div>
            ) : (
              <button className="secondary" style={{ marginTop: 10 }} onClick={() => setAcikId(k.id)}>
                Detay Doldur
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
