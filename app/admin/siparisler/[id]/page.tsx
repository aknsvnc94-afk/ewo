'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Kalem = {
  id: string; satir_metni: string; stok_kodu: string | null; stok_adi: string | null; aciklama: string | null; miktar: string | null; teslim_tarihi: string | null;
  alindi: boolean; alinma_tarihi: string | null; makineler: { id: string; ad: string }[];
  alan: { ad_soyad: string } | null;
};
type Makine = { id: string; ad: string };

function turkceTarihToDate(t: string | null): Date | null {
  if (!t) return null;
  const [g, a, y] = t.split('.');
  if (!g || !a || !y) return null;
  return new Date(Number(y), Number(a) - 1, Number(g));
}

function gecikmisMi(teslimTarihi: string | null, alindi: boolean) {
  if (!teslimTarihi || alindi) return false;
  const t = turkceTarihToDate(teslimTarihi);
  if (!t) return false;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  return t < bugun;
}

export default function SiparisDetayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [siparis, setSiparis] = useState<any>(null);
  const [kalemler, setKalemler] = useState<Kalem[]>([]);
  const [makineler, setMakineler] = useState<Makine[]>([]);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);
  const [isleniyor, setIsleniyor] = useState<string | null>(null);

  async function getir() {
    const res = await fetch(`/api/siparis/${id}`);
    const data = await res.json();
    if (data.error) return;
    setSiparis(data.siparis);
    setKalemler(data.kalemler || []);
  }

  useEffect(() => {
    getir();
    fetch('/api/makineler').then((r) => r.json()).then((d) => setMakineler(d.makineler || []));
  }, [id]);

  async function siparisSil() {
    if (!confirm('Bu siparişi ve tüm kalemlerini KALICI olarak silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/siparis/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/panel/bakim/siparisler');
  }

  async function alindiIsaretle(kalemId: string, deger: boolean) {
    setIsleniyor(kalemId);
    try {
      await fetch(`/api/siparis-kalemi/${kalemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alindi: deger }),
      });
      await getir();
    } finally {
      setIsleniyor(null);
    }
  }

  async function makineSec(kalemId: string, makineId: string) {
    setIsleniyor(kalemId);
    try {
      await fetch(`/api/siparis-kalemi/${kalemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ makine_id: makineId || null }),
      });
      await getir();
    } finally {
      setIsleniyor(null);
    }
  }

  if (!siparis) return <div className="container"><p className="muted">Yükleniyor...</p></div>;

  const alinan = kalemler.filter((k) => k.alindi).length;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{siparis.talep_no ? `Talep No: ${siparis.talep_no}` : siparis.dosya_adi}</h1>
        <div className="row">
          <button className="danger" onClick={siparisSil}>Siparişi Sil</button>
          <Link href="/panel/bakim/siparisler"><button className="secondary">← Sipariş Listesine Dön</button></Link>
        </div>
      </div>
      <p className="muted">
        {siparis.bolum && <>Bölüm: {siparis.bolum} · </>}
        {siparis.kisi && <>Talep Eden: {siparis.kisi} · </>}
        {siparis.tarih && <>Talep Tarihi: {siparis.tarih} · </>}
        Yüklenme: {new Date(siparis.yuklenme_tarihi).toLocaleString('tr-TR')} · Yükleyen: {siparis.yukleyen?.ad_soyad || '-'}
        {siparis.pdf_url && <> · <a href={siparis.pdf_url} target="_blank" rel="noopener noreferrer">Orijinal PDF</a></>}
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Kalemler ({alinan}/{kalemler.length} alındı)</h3>
          <button className="secondary" onClick={() => setDuzenlemeModu((d) => !d)}>
            {duzenlemeModu ? 'Düzenlemeyi Bitir' : 'Makine Eşleşmelerini Düzenle'}
          </button>
        </div>
        <p className="muted">Açıklamadaki makine kodları ("MAKİNAKODU1 / MAKİNAKODU2" formatı) yüklemede otomatik eşlenir. Yanlış/eksik eşleşmeleri "Makine Eşleşmelerini Düzenle" ile buradan düzeltebilirsiniz.</p>
        <table>
          <thead><tr><th>#</th><th>Stok Kodu</th><th>Stok Adı</th><th>Açıklama</th><th>Miktar</th><th>Teslim Tarihi</th><th>Makine</th><th>Durum</th><th>Alan</th><th>Tarih/Saat</th><th></th></tr></thead>
          <tbody>
            {kalemler.map((k, i) => {
              const gecikmis = gecikmisMi(k.teslim_tarihi, k.alindi);
              // Eski kayıtlarda stok_adi/aciklama sütunları boş olabilir; o durumda
              // satir_metni'nden çıkarmaya devam ediyoruz (geriye dönük uyumluluk).
              const stokAdi = k.stok_adi ?? (k.stok_kodu ? k.satir_metni.split('—')[1]?.split('|')[0]?.trim() : k.satir_metni);
              return (
                <tr key={k.id}>
                  <td>{i + 1}</td>
                  <td>{k.stok_kodu || '-'}</td>
                  <td>{stokAdi || '-'}</td>
                  <td>{k.aciklama || <span className="muted">-</span>}</td>
                  <td>{k.miktar || '-'}</td>
                  <td style={{ color: gecikmis ? 'var(--danger)' : undefined, fontWeight: gecikmis ? 700 : undefined }}>
                    {k.teslim_tarihi || '-'} {gecikmis ? '(GECİKMİŞ)' : ''}
                  </td>
                  <td>
                    {duzenlemeModu ? (
                      <select value={k.makineler[0]?.id || ''} onChange={(e) => makineSec(k.id, e.target.value)} disabled={isleniyor === k.id}>
                        <option value="">-</option>
                        {makineler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
                      </select>
                    ) : (
                      k.makineler.length > 0 ? k.makineler.map((m) => m.ad).join(', ') : <span className="muted">-</span>
                    )}
                  </td>
                  <td className={k.alindi ? 'status-Tamamlandı' : 'status-Beklemede'}>{k.alindi ? 'Alındı' : 'Bekliyor'}</td>
                  <td>{k.alan?.ad_soyad || '-'}</td>
                  <td>{k.alinma_tarihi ? new Date(k.alinma_tarihi).toLocaleString('tr-TR') : '-'}</td>
                  <td>
                    {k.alindi ? (
                      <button className="secondary" onClick={() => alindiIsaretle(k.id, false)} disabled={isleniyor === k.id}>Geri Al</button>
                    ) : (
                      <button onClick={() => alindiIsaretle(k.id, true)} disabled={isleniyor === k.id}>
                        {isleniyor === k.id ? '...' : 'Alındı'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="record-list mobile-only">
          {kalemler.map((k, i) => {
            const gecikmis = gecikmisMi(k.teslim_tarihi, k.alindi);
            const stokAdi = k.stok_adi ?? (k.stok_kodu ? k.satir_metni.split('—')[1]?.split('|')[0]?.trim() : k.satir_metni);
            return (
              <div key={k.id} className="record-item" style={{ borderLeft: gecikmis ? '4px solid var(--danger)' : undefined }}>
                <div>{i + 1}. {k.stok_kodu ? `${k.stok_kodu} — ` : ''}{stokAdi}</div>
                {k.aciklama && <div className="muted">Açıklama: {k.aciklama}</div>}
                {k.miktar && <div className="muted">Miktar: {k.miktar}</div>}
                {k.teslim_tarihi && (
                  <div style={{ color: gecikmis ? 'var(--danger)' : undefined, fontWeight: gecikmis ? 700 : undefined }} className={gecikmis ? '' : 'muted'}>
                    Teslim: {k.teslim_tarihi} {gecikmis ? '(GECİKMİŞ)' : ''}
                  </div>
                )}
                <div className={k.alindi ? 'status-Tamamlandı' : 'status-Beklemede'}>{k.alindi ? 'Alındı' : 'Bekliyor'}</div>
                {k.alindi && <div className="muted">{k.alan?.ad_soyad} · {k.alinma_tarihi ? new Date(k.alinma_tarihi).toLocaleString('tr-TR') : ''}</div>}
                {duzenlemeModu ? (
                  <label className="muted" style={{ display: 'block', marginTop: 6 }}>Makine
                    <select value={k.makineler[0]?.id || ''} onChange={(e) => makineSec(k.id, e.target.value)} disabled={isleniyor === k.id} style={{ width: '100%', marginTop: 4 }}>
                      <option value="">-</option>
                      {makineler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
                    </select>
                  </label>
                ) : (
                  k.makineler.length > 0 && <div className="muted">Makine: {k.makineler.map((m) => m.ad).join(', ')}</div>
                )}
                {k.alindi ? (
                  <button className="secondary" style={{ marginTop: 8 }} onClick={() => alindiIsaretle(k.id, false)} disabled={isleniyor === k.id}>Geri Al</button>
                ) : (
                  <button style={{ marginTop: 8 }} onClick={() => alindiIsaretle(k.id, true)} disabled={isleniyor === k.id}>
                    {isleniyor === k.id ? 'İşleniyor...' : 'Alındı'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
