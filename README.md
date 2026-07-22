# EWO Arıza Takip Sistemi (Web)

Plaskar bakım ekibi için ERP arıza kayıtlarını yükleme, personele atama ve
personelin mobil/PC üzerinden detay (aksiyon, kök neden, tamamlanma durumu)
doldurmasını sağlayan web uygulaması. Telefonda "ana ekrana ekle" ile
uygulama gibi çalışır (PWA).

## Mimari
- **Frontend:** Next.js 14 (App Router) + PWA
- **Backend:** Next.js API Routes
- **Veritabanı:** Supabase (Postgres)
- **Giriş:** Kullanıcı adı + PIN (imzalı cookie ile 30 gün oturum)
- **Barındırma:** Vercel (frontend) + Supabase (veritabanı) — ikisi de ücretsiz planla başlar

## Kurulum Adımları

### 1) Supabase projesi oluştur
1. https://supabase.com üzerinde yeni proje aç
2. SQL Editor'e girip `supabase/schema.sql` dosyasının tamamını çalıştır
3. Kendi admin kullanıcını ekle (PIN'i kendi belirlediğinle değiştir):
   ```sql
   insert into personel (ad_soyad, kullanici_adi, pin_hash, rol)
   values ('Akın Sevinç', 'akin', crypt('SENIN_PININ', gen_salt('bf')), 'admin');
   ```
4. Bakım personelini de aynı şekilde ekle (rol = 'personel')
5. Settings > API sayfasından `Project URL` ve `service_role` key'i kopyala

### 2) Ortam değişkenleri
`.env.example` dosyasını `.env.local` olarak kopyala ve Supabase bilgilerini gir:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=uzun-rastgele-bir-metin
```

### 3) Yerelde çalıştır (test için)
```bash
npm install
npm run dev
```
http://localhost:3000 adresinden test edebilirsin.

### 4) Vercel'e deploy et
1. Bu klasörü bir GitHub reposuna push et
2. https://vercel.com üzerinde "Import Project" ile repoyu bağla
3. Environment Variables kısmına `.env.local` içeriğini gir
4. Deploy et — sana `https://xxx.vercel.app` gibi bir adres verecek

### 5) Telefonda kullanım
Vercel adresini telefonda tarayıcıda aç → paylaş/menü > "Ana Ekrana Ekle".
Artık uygulama gibi ikonla açılır.

## Kullanım Akışı
1. **Admin (sen):** ERP'den ANA VERİ formatında Excel export al → `/admin` sayfasından yükle
   → sistem otomatik olarak DURUŞ KODU'na göre MA/BA/KA/RA kategorilerine ayırır,
   mükerrer kayıtları atlar
2. **Admin:** Kayıtları seç → ilgili personele topluca ata
3. **Personel:** Telefonundan `/personel` sayfasını açar, kendine atanan kayıtları görür,
   "Detay Doldur" ile Aksiyon / Kök Neden / Hedef Tarih / Tamamlanma Durumu girer

## Sonraki Aşamalar (yol haritası)
- [ ] Telegram bot ile yeni atama bildirimi (senin AnKA GLC botunla entegre edilebilir)
- [ ] Pareto/KPI dashboard sayfası (mevcut bakim_panel.html mantığıyla)
- [ ] Admin'den yeni personel ekleme arayüzü (şu an SQL ile ekleniyor)
- [ ] Excel'e geri dışa aktarma (raporlama için)
- [ ] Gerçek PWA ikonları (public/icon-192.png, icon-512.png ekle)

## Notlar
- `service_role` key çok güçlü bir anahtardır, sadece sunucu tarafında (.env.local, Vercel env vars)
  kullanılır, asla frontend koduna veya GitHub'a commit edilmemelidir (.gitignore'da .env.local var).
- Mükerrer kayıt kontrolü TEZGAH + BAŞLANGIÇ + DURUŞ KODU + İŞ EMRİ DETAY KODU + SÜRE kombinasyonuyla yapılır.
  ERP export formatı değişirse `app/api/import/route.ts` içindeki `COLS` dizisini güncelle.
