'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const ARIZA_TURLERI = ['PLC', 'Yazılım', 'Mekanik', 'Elektrik', 'Hidrolik', 'Pnömatik'];
const KOK_SEBEP_TIPLERI = ['İnsan', 'Makine', 'Metot', 'Malzeme', 'Ölçüm', 'Çevre', 'Diğer'];

type Onlem = { aciklama: string; sorumlu: string; plan_tarihi: string };
const bosOnlem = (): Onlem => ({ aciklama: '', sorumlu: '', plan_tarihi: '' });

function onlemleriHazirla(veri: any, adet: number): Onlem[] {
  const gelenler: Onlem[] = Array.isArray(veri) ? veri : [];
  const sonuc = [...gelenler];
  while (sonuc.length < adet) sonuc.push(bosOnlem());
  return sonuc.slice(0, adet);
}

function tarihSaatInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EwoFormuSayfasi() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [kayit, setKayit] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  useEffect(() => {
    fetch(`/api/records/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setMesaj(data.error); return; }
        setKayit(data.kayit);
        setForm({
          ariza_turu: data.kayit.ariza_turu || [],
          arizanin_tanimi: data.kayit.arizanin_tanimi || '',
          direk_sebep_cozum: data.kayit.direk_sebep_cozum || '',
          zaman_ariza_baslangic: tarihSaatInput(data.kayit.zaman_ariza_baslangic || data.kayit.baslangic),
          zaman_mudahale_baslangic: tarihSaatInput(data.kayit.zaman_mudahale_baslangic),
          zaman_teshis_baslangic: tarihSaatInput(data.kayit.zaman_teshis_baslangic),
          zaman_tamir_baslangic: tarihSaatInput(data.kayit.zaman_tamir_baslangic),
          zaman_yedek_parca_bekleme: tarihSaatInput(data.kayit.zaman_yedek_parca_bekleme),
          zaman_montaj_baslangic: tarihSaatInput(data.kayit.zaman_montaj_baslangic),
          zaman_makine_baslatilma: tarihSaatInput(data.kayit.zaman_makine_baslatilma),
          zaman_uretim_baslangic: tarihSaatInput(data.kayit.zaman_uretim_baslangic),
          direk_sebep: data.kayit.direk_sebep || '',
          neden_1: data.kayit.neden_1 || '',
          neden_2: data.kayit.neden_2 || '',
          neden_3: data.kayit.neden_3 || '',
          neden_4: data.kayit.neden_4 || '',
          neden_5: data.kayit.neden_5 || '',
          kok_neden_turu: data.kayit.kok_neden_turu || '',
          onlemler_kok_neden: onlemleriHazirla(data.kayit.onlemler_kok_neden, 3),
          onlemler_sifir_ariza: onlemleriHazirla(data.kayit.onlemler_sifir_ariza, 4),
          analiz_sorumlusu: data.kayit.analiz_sorumlusu || '',
          sonuc: data.kayit.sonuc || '',
        });
      });
  }, [id]);

  function alan(key: string, deger: any) {
    setForm((f: any) => ({ ...f, [key]: deger }));
  }

  function turSec(tur: string) {
    setForm((f: any) => {
      const mevcut: string[] = f.ariza_turu || [];
      const yeni = mevcut.includes(tur) ? mevcut.filter((t) => t !== tur) : [...mevcut, tur];
      return { ...f, ariza_turu: yeni };
    });
  }

  function onlemGuncelle(liste: 'onlemler_kok_neden' | 'onlemler_sifir_ariza', i: number, alanAdi: keyof Onlem, deger: string) {
    setForm((f: any) => {
      const yeniListe = [...f[liste]];
      yeniListe[i] = { ...yeniListe[i], [alanAdi]: deger };
      return { ...f, [liste]: yeniListe };
    });
  }

  async function kaydet(gonderVeOnayaSun: boolean) {
    setKaydediliyor(true);
    setMesaj('');
    try {
      const payload: any = {
        id,
        ...form,
        zaman_ariza_baslangic: form.zaman_ariza_baslangic || null,
        zaman_mudahale_baslangic: form.zaman_mudahale_baslangic || null,
        zaman_teshis_baslangic: form.zaman_teshis_baslangic || null,
        zaman_tamir_baslangic: form.zaman_tamir_baslangic || null,
        zaman_yedek_parca_bekleme: form.zaman_yedek_parca_bekleme || null,
        zaman_montaj_baslangic: form.zaman_montaj_baslangic || null,
        zaman_makine_baslatilma: form.zaman_makine_baslatilma || null,
        zaman_uretim_baslangic: form.zaman_uretim_baslangic || null,
      };
      if (gonderVeOnayaSun) payload.tamamlanma_durumu = 'Onay Bekliyor';

      const res = await fetch('/api/update-record', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMesaj(`Hata: ${data.error}`);
        return;
      }
      if (gonderVeOnayaSun) {
        router.push('/personel');
      } else {
        setMesaj('✓ Taslak kaydedildi');
      }
    } finally {
      setKaydediliyor(false);
    }
  }

  if (!kayit || !form) return <div className="container"><p className="muted">{mesaj || 'Yükleniyor...'}</p></div>;

  return (
    <div className="container">
      <h1>Arıza Müdahale ve Analiz Formu (EWO)</h1>
      <p className="muted">{kayit.tezgah} · {kayit.durus_adi} · {kayit.baslangic ? new Date(kayit.baslangic).toLocaleString('tr-TR') : '-'}</p>

      <div className="card">
        <h3>Genel Bilgi</h3>
        <div className="row">
          <div><span className="muted">Makine No</span><div>{kayit.tezgah}</div></div>
          <div><span className="muted">Vardiya</span><div>{kayit.vardiya ?? '-'}</div></div>
          <div><span className="muted">Doküman No</span><div>{kayit.dokuman_no || 'F13-31(R00)'}</div></div>
        </div>
      </div>

      <div className="card">
        <h3>Arıza Türü</h3>
        <div className="row">
          {ARIZA_TURLERI.map((t) => (
            <label key={t} className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={form.ariza_turu.includes(t)} onChange={() => turSec(t)} /> {t}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Zaman Çizelgesi</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            ['zaman_ariza_baslangic', 'Arıza başlangıcı'],
            ['zaman_mudahale_baslangic', 'Müdahale başlangıcı'],
            ['zaman_teshis_baslangic', 'Teşhis başlangıcı'],
            ['zaman_tamir_baslangic', 'Tamir başlangıcı'],
            ['zaman_yedek_parca_bekleme', 'Yedek parça bekleme'],
            ['zaman_montaj_baslangic', 'Yeniden montajın başlangıcı'],
            ['zaman_makine_baslatilma', 'Makinenin başlatılması'],
            ['zaman_uretim_baslangic', 'Üretim başlangıcı'],
          ].map(([key, label]) => (
            <label key={key} className="muted">{label}
              <input type="datetime-local" value={form[key]} onChange={(e) => alan(key, e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Problem Tanımı ve Direk Sebep Analizi</h3>
        <label className="muted">Arızanın tanımı
          <textarea value={form.arizanin_tanimi} onChange={(e) => alan('arizanin_tanimi', e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label className="muted" style={{ display: 'block', marginTop: 10 }}>Arızanın Direk Sebep ve çözümü
          <textarea value={form.direk_sebep_cozum} onChange={(e) => alan('direk_sebep_cozum', e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} />
        </label>
      </div>

      <div className="card">
        <h3>Kök Neden Analizi (5 Neden — gerekirse doldurun)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <label className="muted">Direk Sebep
            <input value={form.direk_sebep} onChange={(e) => alan('direk_sebep', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
          </label>
          {['neden_1', 'neden_2', 'neden_3', 'neden_4', 'neden_5'].map((k, i) => (
            <label key={k} className="muted">Neden {i + 1}
              <input value={form[k]} onChange={(e) => alan(k, e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          ))}
        </div>
        <label className="muted" style={{ display: 'block', marginTop: 10 }}>Kök Sebep Tipi
          <select value={form.kok_neden_turu} onChange={(e) => alan('kok_neden_turu', e.target.value)} style={{ width: '100%', marginTop: 4 }}>
            <option value="">Seçiniz...</option>
            {KOK_SEBEP_TIPLERI.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="card">
        <h3>Makine Arızasının Kök Nedenlerine Karşı Önlemler</h3>
        {form.onlemler_kok_neden.map((o: Onlem, i: number) => (
          <div key={i} className="row" style={{ marginBottom: 8 }}>
            <input placeholder={`Önlem ${i + 1}`} value={o.aciklama} onChange={(e) => onlemGuncelle('onlemler_kok_neden', i, 'aciklama', e.target.value)} style={{ flex: 2 }} />
            <input placeholder="Sorumlu" value={o.sorumlu} onChange={(e) => onlemGuncelle('onlemler_kok_neden', i, 'sorumlu', e.target.value)} style={{ flex: 1 }} />
            <input type="date" value={o.plan_tarihi} onChange={(e) => onlemGuncelle('onlemler_kok_neden', i, 'plan_tarihi', e.target.value)} style={{ flex: 1 }} />
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Sıfır Arızayı Sürdürmek İçin Eylemler</h3>
        {form.onlemler_sifir_ariza.map((o: Onlem, i: number) => (
          <div key={i} className="row" style={{ marginBottom: 8 }}>
            <input placeholder={`Eylem ${i + 1}`} value={o.aciklama} onChange={(e) => onlemGuncelle('onlemler_sifir_ariza', i, 'aciklama', e.target.value)} style={{ flex: 2 }} />
            <input placeholder="Sorumlu" value={o.sorumlu} onChange={(e) => onlemGuncelle('onlemler_sifir_ariza', i, 'sorumlu', e.target.value)} style={{ flex: 1 }} />
            <input type="date" value={o.plan_tarihi} onChange={(e) => onlemGuncelle('onlemler_sifir_ariza', i, 'plan_tarihi', e.target.value)} style={{ flex: 1 }} />
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Sonuç</h3>
        <label className="muted">Analiz sorumlusu
          <input value={form.analiz_sorumlusu} onChange={(e) => alan('analiz_sorumlusu', e.target.value)} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label className="muted" style={{ display: 'block', marginTop: 10 }}>Sonuç
          <textarea value={form.sonuc} onChange={(e) => alan('sonuc', e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} />
        </label>
      </div>

      {mesaj && <p>{mesaj}</p>}

      <div className="row" style={{ marginBottom: 24 }}>
        <button className="secondary" onClick={() => kaydet(false)} disabled={kaydediliyor}>Taslak Kaydet</button>
        <button onClick={() => kaydet(true)} disabled={kaydediliyor}>
          {kaydediliyor ? 'Gönderiliyor...' : 'Tamamla ve Gönder'}
        </button>
      </div>
    </div>
  );
}
