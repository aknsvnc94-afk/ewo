'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function tarihGoster(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('tr-TR');
}

export default function AdminKayitIncelePage() {
  const params = useParams();
  const id = params?.id as string;
  const [kayit, setKayit] = useState<any>(null);
  const [mesaj, setMesaj] = useState('');
  const [isleniyor, setIsleniyor] = useState(false);

  async function getir() {
    const res = await fetch(`/api/records/${id}`);
    const data = await res.json();
    if (data.error) { setMesaj(data.error); return; }
    setKayit(data.kayit);
  }

  useEffect(() => { getir(); }, [id]);

  async function durumGuncelle(yeniDurum: string) {
    setIsleniyor(true);
    try {
      const res = await fetch('/api/update-record', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  if (!kayit) return <div className="container"><p className="muted">{mesaj || 'Yükleniyor...'}</p></div>;

  const onlemler = (liste: any[]) => (Array.isArray(liste) ? liste : []).filter((o) => o?.aciklama);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Kayıt İnceleme</h1>
        <Link href="/admin"><button className="secondary">← Listeye Dön</button></Link>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className={`badge badge-${kayit.kategori}`}>{kayit.kategori}</span>{' '}
            <strong>{kayit.tezgah}</strong> — {kayit.durus_adi}
          </div>
          <span className={`status-${kayit.tamamlanma_durumu?.replace(' ', '')}`}>{kayit.tamamlanma_durumu}</span>
        </div>
        <p className="muted">Atanan: {kayit.personel?.ad_soyad || 'Atanmadı'} · Başlangıç: {tarihGoster(kayit.baslangic)} · Süre: {kayit.sure}</p>
        {kayit.aciklama && <p>{kayit.aciklama}</p>}
      </div>

      <div className="card">
        <h3>Arıza Türü</h3>
        <p>{(kayit.ariza_turu || []).join(', ') || <span className="muted">Belirtilmemiş</span>}</p>
      </div>

      <div className="card">
        <h3>Zaman Çizelgesi</h3>
        <table>
          <tbody>
            <tr><td className="muted">Arıza başlangıcı</td><td>{tarihGoster(kayit.zaman_ariza_baslangic)}</td></tr>
            <tr><td className="muted">Müdahale başlangıcı</td><td>{tarihGoster(kayit.zaman_mudahale_baslangic)}</td></tr>
            <tr><td className="muted">Teşhis başlangıcı</td><td>{tarihGoster(kayit.zaman_teshis_baslangic)}</td></tr>
            <tr><td className="muted">Tamir başlangıcı</td><td>{tarihGoster(kayit.zaman_tamir_baslangic)}</td></tr>
            <tr><td className="muted">Yedek parça bekleme</td><td>{tarihGoster(kayit.zaman_yedek_parca_bekleme)}</td></tr>
            <tr><td className="muted">Yeniden montaj başlangıcı</td><td>{tarihGoster(kayit.zaman_montaj_baslangic)}</td></tr>
            <tr><td className="muted">Makinenin başlatılması</td><td>{tarihGoster(kayit.zaman_makine_baslatilma)}</td></tr>
            <tr><td className="muted">Üretim başlangıcı</td><td>{tarihGoster(kayit.zaman_uretim_baslangic)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Problem Tanımı</h3>
        <p><strong>Arızanın tanımı:</strong> {kayit.arizanin_tanimi || '-'}</p>
        <p><strong>Direk sebep ve çözüm:</strong> {kayit.direk_sebep_cozum || '-'}</p>
      </div>

      <div className="card">
        <h3>Kök Neden Analizi</h3>
        <p><strong>Direk Sebep:</strong> {kayit.direk_sebep || '-'}</p>
        {[1, 2, 3, 4, 5].map((n) => (
          <p key={n}><strong>Neden {n}:</strong> {kayit[`neden_${n}`] || '-'}</p>
        ))}
        <p><strong>Kök Sebep Tipi:</strong> {kayit.kok_neden_turu || '-'}</p>
      </div>

      <div className="card">
        <h3>Kök Nedene Karşı Önlemler</h3>
        {onlemler(kayit.onlemler_kok_neden).length === 0 && <p className="muted">Girilmemiş</p>}
        {onlemler(kayit.onlemler_kok_neden).map((o: any, i: number) => (
          <p key={i}>{i + 1}. {o.aciklama} — <span className="muted">{o.sorumlu} · {o.plan_tarihi}</span></p>
        ))}
      </div>

      <div className="card">
        <h3>Sıfır Arıza Eylemleri</h3>
        {onlemler(kayit.onlemler_sifir_ariza).length === 0 && <p className="muted">Girilmemiş</p>}
        {onlemler(kayit.onlemler_sifir_ariza).map((o: any, i: number) => (
          <p key={i}>{i + 1}. {o.aciklama} — <span className="muted">{o.sorumlu} · {o.plan_tarihi}</span></p>
        ))}
      </div>

      <div className="card">
        <h3>Sonuç</h3>
        <p><strong>Analiz sorumlusu:</strong> {kayit.analiz_sorumlusu || '-'}</p>
        <p>{kayit.sonuc || '-'}</p>
      </div>

      {mesaj && <p>{mesaj}</p>}

      <div className="row" style={{ marginBottom: 24 }}>
        <button onClick={() => durumGuncelle('Tamamlandı')} disabled={isleniyor}>Onayla (Tamamlandı)</button>
        <button className="secondary" onClick={() => durumGuncelle('Devam Ediyor')} disabled={isleniyor}>
          Personele Geri Gönder
        </button>
        <a href={`/pdf/${id}`} target="_blank" rel="noopener noreferrer">
          <button className="secondary">PDF Olarak Görüntüle / İndir</button>
        </a>
      </div>
    </div>
  );
}
