'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Fabrika = { id: string; ad: string; kod: string };

const SUPERADMIN_SECIMI = '__superadmin__';

export default function LoginPage() {
  const [fabrikalar, setFabrikalar] = useState<Fabrika[]>([]);
  const [fabrikaSecimi, setFabrikaSecimi] = useState('');
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [pin, setPin] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/fabrikalar')
      .then((res) => res.json())
      .then((data) => setFabrikalar(data.fabrikalar || []))
      .catch(() => {});
  }, []);

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setHata('');
    if (!fabrikaSecimi) {
      setHata('Lütfen fabrika seçin');
      return;
    }
    setYukleniyor(true);
    try {
      const fabrika_id = fabrikaSecimi === SUPERADMIN_SECIMI ? null : fabrikaSecimi;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullanici_adi: kullaniciAdi, pin, fabrika_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHata(data.error || 'Giriş başarısız');
        return;
      }
      if (data.rol === 'superadmin') router.push('/admin/personel');
      else if (data.rol === 'admin') router.push('/admin');
      else router.push('/personel');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-glow" />
      <div className="login-card">
        <div className="login-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h1 className="login-title">Bakım Yönetim Sistemi</h1>
        <p className="muted login-sub">Fabrika bakım operasyonlarınızı tek platformdan yönetin</p>

        <form onSubmit={girisYap} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select
            value={fabrikaSecimi}
            onChange={(e) => setFabrikaSecimi(e.target.value)}
            required
          >
            <option value="" disabled>Fabrika seçin</option>
            {fabrikalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
            <option value={SUPERADMIN_SECIMI} className="login-superadmin-option">Süper Admin</option>
          </select>
          <input
            placeholder="Kullanıcı adı"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            autoCapitalize="none"
            required
          />
          <input
            placeholder="Şifre"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
          {hata && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{hata}</div>}
          <button type="submit" disabled={yukleniyor}>
            {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
