'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ResimYukleyici from '@/components/ResimYukleyici';

const KOK_SEBEP_TIPLERI = [
  'Çalışma koşullarının izlenmemesi',
  'Proje zayıflığı',
  'Dış etkenler',
  'Temel şartların eksikliği',
  'Yetersiz bakım',
  'Eksik beceri/yetkinlik',
];

type Onlem = { aciklama: string; sorumlu_personel_id: string; plan_tarihi: string };
const bosOnlem = (): Onlem => ({ aciklama: '', sorumlu_personel_id: '', plan_tarihi: '' });
function onlemleriHazirla(veri: any, adet: number): Onlem[] {
  const gelenler: Onlem[] = (Array.isArray(veri) ? veri : []).map((o: any) => ({
    aciklama: o.aciklama || '',
    sorumlu_personel_id: o.sorumlu_personel_id || '',
    plan_tarihi: o.plan_tarihi || '',
  }));
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

export default function AdminKayitFormu() {
  const params = useParams();
  const id = params?.id as string;
  const [kayit, setKayit] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [personelListesi, setPersonelListesi] = useState<{ id: string; ad_soyad: string }[]>([]);
  const [mesaj, setMesaj] = useState('');
  const [isleniyor, setIsleniyor] = useState(false);

  async function getir() {
    const res = await fetch(`/api/records/${id}`);
    const data = await res.json();
    if (data.error) { setMesaj(data.error); return; }
    setKayit(data.kayit);
    setForm({
      zaman_ariza_baslangic: tarihSaatInput(data.kayit.zaman_ariza_baslangic || data.kayit.baslangic),
      zaman_mudahale_baslangic: tarihSaatInput(data.kayit.zaman_mudahale_baslangic),
      zaman_teshis_baslangic: tarihSaatInput(data.kayit.zaman_teshis_baslangic),
      zaman_tamir_baslangic: tarihSaatInput(data.kayit.zaman_tamir_baslangic),
      zaman_yedek_parca_bekleme: tarihSaatInput(data.kayit.zaman_yedek_parca_bekleme),
      zaman_montaj_baslangic: tarihSaatInput(data.kayit.zaman_montaj_baslangic),
      zaman_makine_baslatilma: tarihSaatInput(data.kayit.zaman_makine_baslatilma),
      zaman_uretim_baslangic: tarihSaatInput(data.kayit.zaman_uretim_baslangic),
      direk_sebep: data.kayit.direk_sebep || '',
      neden_1: data.kayit.neden_1 || '', neden_2: data.kayit.neden_2 || '',
      neden_3: data.kayit.neden_3 || '', neden_4: data.kayit.neden_4 || '', neden_5: data.kayit.neden_5 || '',
      kok_neden_turu: data.kayit.kok_neden_turu || '',
      onlemler_kok_neden: onlemleriHazirla(data.kayit.onlemler_kok_neden, 3),
      onlemler_sifir_ariza: onlemleriHazirla(data.kayit.onlemler_sifir_ariza, 4),
      analiz_sorumlusu: data.kayit.analiz_sorumlusu || '',
      sonuc: data.kayit.sonuc || '',
    });
  }

  async function personelGetir() {
    const res = await fetch('/api/personel');
    const data = await res.json();
    setPersonelListesi((data.personel || []).filter((p: any) => p.aktif));
  }

  useEffect(() => { getir(); personelGetir(); }, [id]);

  function alan(key: string, deger: any) { setForm((f: any) => ({ ...f, [key]: deger })); }

  function onlemGuncelle(liste: 'onlemler_kok_neden' | 'onlemler_sifir_ariza', i: number, alanAdi: keyof Onlem, deger: string) {
    setForm((f: any) => {
      const yeniListe = [...f[liste]];
      yeniListe[i] = { ...yeniListe[i], [alanAdi]: deger };
      return { ...f, [liste]: yeniListe };
    });
  }

  function bitisiHesapla() {
    if (!form.zaman_ariza_baslangic || !kayit.sure_sn) {
      setMesaj('Hesaplamak için arıza başlangıcı ve süre bilgisi gerekli');
      return;
    }
    const baslangic = new Date(form.zaman_ariza_baslangic);
    const bitis = new Date(baslangic.getTime() + kayit.sure_sn * 1000);
    alan('zaman_uretim_baslangic', tarihSaatInput(bitis.toISOString()));
  }

  async function kaydet() {
    setIsleniyor(true);
    setMesaj('');
    try {
      const payload: any = {
        id, ...form,
        zaman_ariza_baslangic: form.zaman_ariza_baslangic || null,
        zaman_mudahale_baslangic: form.zaman_mudahale_baslangic || null,
        zaman_teshis_baslangic: form.zaman_teshis_baslangic || null,
        zaman_tamir_baslangic: form.zaman_tamir_baslangic || null,
        zaman_yedek_parca_bekleme: form.zaman_yedek_parca_bekleme || null,
        zaman_montaj_baslangic: form.zaman_montaj_baslangic || null,
        zaman_makine_baslatilma: form.zaman_makine_baslatilma || null,
        zaman_uretim_baslangic: form.zaman_uretim_baslangic || null,
      };
      const res = await fetch('/api/update-record', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }

      // Önlemleri izlenebilir aksiyonlara senkronize et
      await fetch('/api/aksiyonlar/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ariza_kayit_id: id, tip: 'kok_neden', onlemler: form.onlemler_kok_neden }),
      });
      await fetch('/api/aksiyonlar/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ariza_kayit_id: id, tip: 'sifir_ariza', onlemler: form.onlemler_sifir_ariza }),
      });

      setMesaj('✓ Kaydedildi ve aksiyonlar güncellendi');
    } finally {
      setIsleniyor(false);
    }
  }

  async function durumGuncelle(yeniDurum: string) {
    setIsleniyor(true);
    try {
      const res = await fetch('/api/update-record', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tamamlanma_durumu: yeniDurum }),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      await getir();
      setMesaj(`✓ Durum "${yeniDurum}" olarak güncellendi`);
    } finally {
      setIsleniyor(false);
    }
  }

  if (!kayit || !form) return <div className="container"><p className="muted">{mesaj || 'Yükleniyor...'}</p></div>;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Kayıt İnceleme ve Analiz</h1>
        <Link href="/admin"><button className="secondary">← Listeye Dön</button></Link>
      </div>

      {kayit.tamamlanma_durumu === 'Onay Bekliyor' && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <strong className="status-Devam">⚠ Personel bu kaydı tamamlayıp onaya gönderdi.</strong> Aşağıdaki analiz alanlarını doldurup onaylayabilirsiniz.
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div><span className={`badge badge-${kayit.kategori}`}>{kayit.kategori}</span>{' '}<strong>{kayit.tezgah}</strong> — {kayit.durus_adi}</div>
          <span className={`status-${kayit.tamamlanma_durumu?.replace(' ', '')}`}>{kayit.tamamlanma_durumu}</span>
        </div>
        <p className="muted">Atanan: {kayit.personel?.ad_soyad || 'Atanmadı'} · Başlangıç: {kayit.baslangic ? new Date(kayit.baslangic).toLocaleString('tr-TR') : '-'} · Süre: {kayit.sure}</p>
        {kayit.kalip_kodu && <p className="muted">Kalıp Kodu: {kayit.kalip_kodu}</p>}
      </div>

      <div className="card">
        <h3>Personelin Bildirdiği Bilgiler</h3>
        <p><strong>Arıza Türü:</strong> {(kayit.ariza_turu || []).join(', ') || '-'}</p>
        <p><strong>Arızanın tanımı:</strong> {kayit.arizanin_tanimi || '-'}</p>
        <p><strong>Direk sebep ve çözüm:</strong> {kayit.direk_sebep_cozum || '-'}</p>
        {(kayit.cozum_resimleri || []).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {kayit.cozum_resimleri.map((url: string) => (
              <img key={url} src={url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        )}
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
            ['zaman_uretim_baslangic', 'Üretim başlangıcı (bitiş)'],
          ].map(([key, label]) => (
            <label key={key} className="muted">{label}
              <input type="datetime-local" value={form[key]} onChange={(e) => alan(key, e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          ))}
        </div>
        <button className="secondary" style={{ marginTop: 10 }} onClick={bitisiHesapla}>
          Üretim Başlangıcını Hesapla (Arıza Başlangıcı + Süre: {kayit.sure})
        </button>
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
        <p className="muted">Sorumlu seçilen personele bu satır otomatik bir aksiyon olarak atanır ve "Aksiyon Takip" sayfasında izlenir.</p>
        {form.onlemler_kok_neden.map((o: Onlem, i: number) => (
          <div key={i} className="row" style={{ marginBottom: 8 }}>
            <input placeholder={`Önlem ${i + 1}`} value={o.aciklama} onChange={(e) => onlemGuncelle('onlemler_kok_neden', i, 'aciklama', e.target.value)} style={{ flex: 2 }} />
            <select value={o.sorumlu_personel_id} onChange={(e) => onlemGuncelle('onlemler_kok_neden', i, 'sorumlu_personel_id', e.target.value)} style={{ flex: 1 }}>
              <option value="">Sorumlu seç...</option>
              {personelListesi.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
            </select>
            <input type="date" value={o.plan_tarihi} onChange={(e) => onlemGuncelle('onlemler_kok_neden', i, 'plan_tarihi', e.target.value)} style={{ flex: 1 }} />
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Sıfır Arızayı Sürdürmek İçin Eylemler</h3>
        {form.onlemler_sifir_ariza.map((o: Onlem, i: number) => (
          <div key={i} className="row" style={{ marginBottom: 8 }}>
            <input placeholder={`Eylem ${i + 1}`} value={o.aciklama} onChange={(e) => onlemGuncelle('onlemler_sifir_ariza', i, 'aciklama', e.target.value)} style={{ flex: 2 }} />
            <select value={o.sorumlu_personel_id} onChange={(e) => onlemGuncelle('onlemler_sifir_ariza', i, 'sorumlu_personel_id', e.target.value)} style={{ flex: 1 }}>
              <option value="">Sorumlu seç...</option>
              {personelListesi.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
            </select>
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

      <div className="card">
        <h3>Ek Fotoğraflar (Admin)</h3>
        <ResimYukleyici kayitId={id} resimler={kayit.cozum_resimleri || []} onDegisti={(yeni) => setKayit({ ...kayit, cozum_resimleri: yeni })} />
      </div>

      {mesaj && <p>{mesaj}</p>}

      <div className="row" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={kaydet} disabled={isleniyor}>Formu Kaydet</button>
        <button onClick={() => durumGuncelle('Tamamlandı')} disabled={isleniyor}>Onayla (Tamamlandı)</button>
        <button className="secondary" onClick={() => durumGuncelle('Devam Ediyor')} disabled={isleniyor}>Personele Geri Gönder</button>
        <a href={`/pdf/${id}`} target="_blank" rel="noopener noreferrer"><button className="secondary">PDF Görüntüle/İndir</button></a>
      </div>
    </div>
  );
}
