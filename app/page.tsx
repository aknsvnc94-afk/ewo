'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [pin, setPin] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setHata('');
    setYukleniyor(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullanici_adi: kullaniciAdi, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHata(data.error || 'Giriş başarısız');
        return;
      }
      router.push(data.rol === 'admin' ? '/admin' : '/personel');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 380, marginTop: '18vh' }}>
      <div className="card">
        <h1 style={{ fontSize: 22 }}>EWO Arıza Takip</h1>
        <p className="muted">Plaskar Bakım Sistemi</p>
        <form onSubmit={girisYap} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
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
