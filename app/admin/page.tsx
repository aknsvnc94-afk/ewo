'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { parseExcelBuffer } from '@/lib/excelParse';

const EWO_ESIK_SANIYE = 20 * 60;
const KATEGORILER = ['MA', 'BA', 'KA', 'RA'];

type Kayit = {
  id: string;
  tezgah: string;
  kategori: 'MA' | 'BA' | 'KA' | 'RA';
  durus_adi: string;
  aciklama: string;
  kalip_kodu: string | null;
  vardiya: number | null;
  baslangic: string;
  sure: string;
  sure_sn: number;
  tamamlanma_durumu: string;
  personel: { ad_soyad: string } | null;
};

type Personel = { id: string; ad_soyad: string; aktif: boolean };

type SiralamaAnahtari = 'tarih_azalan' | 'tarih_artan' | 'sure_azalan' | 'sure_artan' | 'tezgah_az';

export default function AdminPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [personelListesi, setPersonelListesi] = useState<Personel[]>([]);
  const [secililer, setSecililer] = useState<Set<string>>(new Set());
  const [atanacakPersonel, setAtanacakPersonel] = useState('');
  const [kategoriFiltre, setKategoriFiltre] = useState('');
  const [durumFiltre, setDurumFiltre] = useState('');
  const [siralama, setSiralama] = useState<SiralamaAnahtari>('tarih_azalan');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [duzenleForm, setDuzenleForm] = useState<any>({});

  async function verileriGetir() {
    const url = kategoriFiltre ? `/api/records?kategori=${kategoriFiltre}` : '/api/records';
    const res = await fetch(url);
    const data = await res.json();
    setKayitlar(data.kayitlar || []);
  }

  async function personelGetir() {
    const res = await fetch('/api/personel');
    const data = await res.json();
    setPersonelListesi((data.personel || []).filter((p: Personel) => p.aktif));
  }

  useEffect(() => {
    verileriGetir();
    personelGetir();
  }, [kategoriFiltre]);

  async function dosyaYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setYukleniyor(true);
    setMesaj('Dosya okunuyor...');
    try {
      const buf = await file.arrayBuffer();
      const { kayitlar, toplamSatir, hata } = parseExcelBuffer(buf);

      if (hata) { setMesaj(`Hata: ${hata}`); return; }
      if (kayitlar.length === 0) {
        setMesaj(`Toplam ${toplamSatir} satır tarandı, MA/BA/KA/RA kategorisinde geçerli arıza kaydı bulunamadı.`);
        return;
      }

      setMesaj(`${kayitlar.length} kayıt bulundu, sunucuya gönderiliyor...`);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kayitlar, toplamSatir }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMesaj(`Hata: ${data.error}`);
      } else {
        setMesaj(`✓ ${data.eklenen} yeni kayıt eklendi (${data.atlanan_mukerrer} mükerrer atlandı)`);
        verileriGetir();
      }
    } catch (err: any) {
      setMesaj(`Hata: Dosya okunamadı (${err?.message || 'bilinmeyen hata'})`);
    } finally {
      setYukleniyor(false);
      e.target.value = '';
    }
  }

  function toggleSecim(id: string) {
    const yeni = new Set(secililer);
    yeni.has(id) ? yeni.delete(id) : yeni.add(id);
    setSecililer(yeni);
  }

  async function ataYap() {
    if (!atanacakPersonel || secililer.size === 0) return;
    const res = await fetch('/api/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kayit_idler: Array.from(secililer), personel_id: atanacakPersonel }),
    });
    const data = await res.json();
    if (res.ok) {
      setMesaj(`✓ ${data.atanan_sayi} kayıt atandı`);
      setSecililer(new Set());
      verileriGetir();
    }
  }

  async function kayitSil(idler: string[]) {
    if (idler.length === 0) return;
    const onayMesaji = idler.length === 1
      ? 'Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?'
      : `${idler.length} kaydı kalıcı olarak silmek istediğinize emin misiniz?`;
    if (!confirm(onayMesaji)) return;

    const res = await fetch('/api/records', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idler }),
    });
    const data = await res.json();
    if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
    setMesaj(`✓ ${data.silinen} kayıt silindi`);
    setSecililer(new Set());
    verileriGetir();
  }

  function duzenlemeyeBasla(k: Kayit) {
    setDuzenlenenId(k.id);
    setDuzenleForm({
      tezgah: k.tezgah || '', kategori: k.kategori, durus_adi: k.durus_adi || '',
      kalip_kodu: k.kalip_kodu || '', vardiya: k.vardiya ?? '', aciklama: k.aciklama || '',
    });
  }

  async function duzenlemeyiKaydet(id: string) {
    const res = await fetch('/api/update-record', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        tezgah: duzenleForm.tezgah,
        kategori: duzenleForm.kategori,
        durus_adi: duzenleForm.durus_adi,
        kalip_kodu: duzenleForm.kalip_kodu || null,
        vardiya: duzenleForm.vardiya === '' ? null : Number(duzenleForm.vardiya),
        aciklama: duzenleForm.aciklama,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
    setDuzenlenenId(null);
    verileriGetir();
  }

  const siraliKayitlar = useMemo(() => {
    let liste = [...kayitlar];
    if (durumFiltre) liste = liste.filter((k) => k.tamamlanma_durumu === durumFiltre);
    switch (siralama) {
      case 'tarih_artan': return liste.sort((a, b) => new Date(a.baslangic).getTime() - new Date(b.baslangic).getTime());
      case 'tarih_azalan': return liste.sort((a, b) => new Date(b.baslangic).getTime() - new Date(a.baslangic).getTime());
      case 'sure_artan': return liste.sort((a, b) => (a.sure_sn || 0) - (b.sure_sn || 0));
      case 'sure_azalan': return liste.sort((a, b) => (b.sure_sn || 0) - (a.sure_sn || 0));
      case 'tezgah_az': return liste.sort((a, b) => (a.tezgah || '').localeCompare(b.tezgah || ''));
      default: return liste;
    }
  }, [kayitlar, siralama, durumFiltre]);

  const onayBekleyenSayisi = useMemo(() => kayitlar.filter((k) => k.tamamlanma_durumu === 'Onay Bekliyor').length, [kayitlar]);

  // Personel bazlı atanan iş sayısı (basit grafik için)
  const personelGrafik = useMemo(() => {
    const sayac: Record<string, number> = {};
    kayitlar.forEach((k) => {
      const ad = k.personel?.ad_soyad || 'Atanmamış';
      sayac[ad] = (sayac[ad] || 0) + 1;
    });
    const girdiler = Object.entries(sayac).sort((a, b) => b[1] - a[1]);
    const maksimum = Math.max(1, ...girdiler.map(([, adet]) => adet));
    return { girdiler, maksimum };
  }, [kayitlar]);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Admin Paneli</h1>
        <div className="row">
          <Link href="/admin/aksiyonlar"><button className="secondary">Aksiyon Takip</button></Link>
          <Link href="/admin/analiz"><button className="secondary">EWO Analiz / Pareto</button></Link>
          <Link href="/admin/personel"><button className="secondary">Personel Yönetimi</button></Link>
        </div>
      </div>

      <div className="card">
        <h3>ERP Excel Yükle</h3>
        <p className="muted">ANA VERİ / DurusTablosuDetay formatındaki .xlsx dosyasını seçin. Mükerrer kayıtlar otomatik atlanır.</p>
        <input type="file" accept=".xlsx,.xls" onChange={dosyaYukle} disabled={yukleniyor} />
        {mesaj && <p style={{ marginTop: 10 }}>{mesaj}</p>}
      </div>

      {onayBekleyenSayisi > 0 && (
        <div className="card" style={{ borderColor: 'var(--warn)', cursor: 'pointer' }} onClick={() => setDurumFiltre('Onay Bekliyor')}>
          <strong className="status-Devam">⚠ {onayBekleyenSayisi} kayıt onay bekliyor.</strong> Kontrol etmek için tıklayın (liste filtrelenecek).
        </div>
      )}

      <div className="card">
        <h3>Personel Bazlı Atanan İş Sayısı</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {personelGrafik.girdiler.length === 0 && <p className="muted">Henüz kayıt yok</p>}
          {personelGrafik.girdiler.map(([ad, adet]) => (
            <div key={ad} className="row" style={{ gap: 10 }}>
              <div style={{ width: 140, fontSize: 13 }} className="muted">{ad}</div>
              <div style={{ flex: 1, background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden', height: 18 }}>
                <div style={{ width: `${(adet / personelGrafik.maksimum) * 100}%`, background: 'var(--accent)', height: '100%' }} />
              </div>
              <div style={{ width: 24, textAlign: 'right', fontSize: 13 }}>{adet}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h3>Arıza Kayıtları ({siraliKayitlar.length})</h3>
          <div className="row">
            <select value={kategoriFiltre} onChange={(e) => setKategoriFiltre(e.target.value)}>
              <option value="">Tüm Kategoriler</option>
              <option value="MA">MA - Makine Arızası</option>
              <option value="BA">BA - Montaj Banko Arızası</option>
              <option value="KA">KA - Kalıp Arızası</option>
              <option value="RA">RA - Robot Arızası</option>
            </select>
            <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              <option value="Beklemede">Beklemede</option>
              <option value="Devam Ediyor">Devam Ediyor</option>
              <option value="Onay Bekliyor">Onay Bekliyor</option>
              <option value="Tamamlandı">Tamamlandı</option>
              <option value="İptal">İptal</option>
            </select>
            <select value={siralama} onChange={(e) => setSiralama(e.target.value as SiralamaAnahtari)}>
              <option value="tarih_azalan">Tarih (Yeni → Eski)</option>
              <option value="tarih_artan">Tarih (Eski → Yeni)</option>
              <option value="sure_azalan">Süre (Uzun → Kısa)</option>
              <option value="sure_artan">Süre (Kısa → Uzun)</option>
              <option value="tezgah_az">Tezgah (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ margin: '12px 0' }}>
          <select value={atanacakPersonel} onChange={(e) => setAtanacakPersonel(e.target.value)}>
            <option value="">Personel seç...</option>
            {personelListesi.map((p) => (
              <option key={p.id} value={p.id}>{p.ad_soyad}</option>
            ))}
          </select>
          <button onClick={ataYap} disabled={!atanacakPersonel || secililer.size === 0}>
            Seçilenleri Ata ({secililer.size})
          </button>
          <button className="danger" onClick={() => kayitSil(Array.from(secililer))} disabled={secililer.size === 0}>
            Seçilenleri Sil ({secililer.size})
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th></th><th>Tezgah</th><th>Kategori</th><th>Kalıp Kodu</th><th>Duruş</th><th>Açıklama</th><th>Başlangıç</th><th>Süre</th><th>Durum</th><th>Atanan</th><th></th>
            </tr>
          </thead>
          <tbody>
            {siraliKayitlar.map((k) => {
              const ewoGerekli = (k.sure_sn || 0) > EWO_ESIK_SANIYE || ['Onay Bekliyor', 'Tamamlandı'].includes(k.tamamlanma_durumu);
              const duzenleniyor = duzenlenenId === k.id;

              if (duzenleniyor) {
                return (
                  <tr key={k.id}>
                    <td colSpan={10}>
                      <div className="row" style={{ flexWrap: 'wrap', padding: '8px 0' }}>
                        <input placeholder="Tezgah" value={duzenleForm.tezgah} onChange={(e) => setDuzenleForm({ ...duzenleForm, tezgah: e.target.value })} style={{ width: 110 }} />
                        <select value={duzenleForm.kategori} onChange={(e) => setDuzenleForm({ ...duzenleForm, kategori: e.target.value })}>
                          {KATEGORILER.map((k2) => <option key={k2} value={k2}>{k2}</option>)}
                        </select>
                        <input placeholder="Duruş Adı" value={duzenleForm.durus_adi} onChange={(e) => setDuzenleForm({ ...duzenleForm, durus_adi: e.target.value })} style={{ width: 160 }} />
                        <input placeholder="Kalıp Kodu" value={duzenleForm.kalip_kodu} onChange={(e) => setDuzenleForm({ ...duzenleForm, kalip_kodu: e.target.value })} style={{ width: 110 }} />
                        <input placeholder="Vardiya" value={duzenleForm.vardiya} onChange={(e) => setDuzenleForm({ ...duzenleForm, vardiya: e.target.value })} style={{ width: 70 }} />
                        <input placeholder="Açıklama" value={duzenleForm.aciklama} onChange={(e) => setDuzenleForm({ ...duzenleForm, aciklama: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                        <button onClick={() => duzenlemeyiKaydet(k.id)}>Kaydet</button>
                        <button className="secondary" onClick={() => setDuzenlenenId(null)}>Vazgeç</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={k.id}>
                  <td><input type="checkbox" checked={secililer.has(k.id)} onChange={() => toggleSecim(k.id)} /></td>
                  <td>{k.tezgah}</td>
                  <td><span className={`badge badge-${k.kategori}`}>{k.kategori}</span></td>
                  <td>{k.kategori === 'KA' ? (k.kalip_kodu || <span className="muted">-</span>) : ''}</td>
                  <td>{k.durus_adi}</td>
                  <td className="muted" style={{ maxWidth: 220 }}>{k.aciklama}</td>
                  <td>{k.baslangic ? new Date(k.baslangic).toLocaleString('tr-TR') : '-'}</td>
                  <td>{k.sure}</td>
                  <td className={`status-${k.tamamlanma_durumu?.replace(' ', '')}`}>{k.tamamlanma_durumu}</td>
                  <td>{k.personel?.ad_soyad || <span className="muted">Atanmadı</span>}</td>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      {ewoGerekli && <Link href={`/admin/kayit/${k.id}`}><button className="secondary">İncele</button></Link>}
                      <button className="secondary" onClick={() => duzenlemeyeBasla(k)}>Düzenle</button>
                      <button className="danger" onClick={() => kayitSil([k.id])}>Sil</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="record-list mobile-only">
          {siraliKayitlar.map((k) => {
            const ewoGerekli = (k.sure_sn || 0) > EWO_ESIK_SANIYE || ['Onay Bekliyor', 'Tamamlandı'].includes(k.tamamlanma_durumu);
            const duzenleniyor = duzenlenenId === k.id;

            if (duzenleniyor) {
              return (
                <div key={k.id} className="record-item" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input placeholder="Tezgah" value={duzenleForm.tezgah} onChange={(e) => setDuzenleForm({ ...duzenleForm, tezgah: e.target.value })} />
                  <select value={duzenleForm.kategori} onChange={(e) => setDuzenleForm({ ...duzenleForm, kategori: e.target.value })}>
                    {KATEGORILER.map((k2) => <option key={k2} value={k2}>{k2}</option>)}
                  </select>
                  <input placeholder="Duruş Adı" value={duzenleForm.durus_adi} onChange={(e) => setDuzenleForm({ ...duzenleForm, durus_adi: e.target.value })} />
                  <input placeholder="Kalıp Kodu" value={duzenleForm.kalip_kodu} onChange={(e) => setDuzenleForm({ ...duzenleForm, kalip_kodu: e.target.value })} />
                  <input placeholder="Vardiya" value={duzenleForm.vardiya} onChange={(e) => setDuzenleForm({ ...duzenleForm, vardiya: e.target.value })} />
                  <input placeholder="Açıklama" value={duzenleForm.aciklama} onChange={(e) => setDuzenleForm({ ...duzenleForm, aciklama: e.target.value })} />
                  <div className="row">
                    <button onClick={() => duzenlemeyiKaydet(k.id)}>Kaydet</button>
                    <button className="secondary" onClick={() => setDuzenlenenId(null)}>Vazgeç</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={k.id} className="record-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <label className="row">
                    <input type="checkbox" checked={secililer.has(k.id)} onChange={() => toggleSecim(k.id)} />
                    <strong>{k.tezgah}</strong>
                  </label>
                  <span className={`badge badge-${k.kategori}`}>{k.kategori}</span>
                </div>
                <div className="muted">{k.durus_adi}</div>
                {k.kategori === 'KA' && k.kalip_kodu && <div className="muted">Kalıp Kodu: {k.kalip_kodu}</div>}
                {k.aciklama && <div style={{ marginTop: 4 }}>{k.aciklama}</div>}
                <div className="muted">{k.baslangic ? new Date(k.baslangic).toLocaleString('tr-TR') : '-'} · {k.sure}</div>
                <div className={`status-${k.tamamlanma_durumu?.replace(' ', '')}`}>{k.tamamlanma_durumu}</div>
                <div className="muted">{k.personel?.ad_soyad || 'Atanmadı'}</div>
                <div className="row" style={{ marginTop: 8 }}>
                  {ewoGerekli && <Link href={`/admin/kayit/${k.id}`}><button className="secondary">İncele</button></Link>}
                  <button className="secondary" onClick={() => duzenlemeyeBasla(k)}>Düzenle</button>
                  <button className="danger" onClick={() => kayitSil([k.id])}>Sil</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
