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
2. SQL Editor'e girip **önce `supabase/schema.sql`**, **sonra `supabase/schema_v2_ewo_form.sql`** dosyalarının tamamını sırasıyla çalıştır
3. Kendi admin kullanıcını ekle (PIN'i kendi belirlediğinle değiştir):
   ```sql
   insert into personel (ad_soyad, kullanici_adi, pin_hash, rol)
   values ('Akın Sevinç', 'akin', crypt('SENIN_SIFREN', gen_salt('bf')), 'admin');
   ```
   (Diğer personelleri artık `/admin/personel` sayfasından, SQL yazmadan ekleyebilirsin.)
4. Settings > API sayfasından `Project URL` ve `service_role`/`secret` key'i kopyala

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
1. **Admin (sen):** `/admin/personel` sayfasından bakım personeline kullanıcı adı + şifre tanımla
2. **Admin:** ERP'den ANA VERİ/DurusTablosuDetay formatında Excel export al → `/admin` sayfasından yükle
   → dosya **tarayıcında** parse edilir (büyük dosyalarda sunucu limiti sorunu yaşanmaz),
   DURUŞ KODU'na göre MA/BA/KA/RA kategorilerine ayrılır, mükerrer kayıtlar atlanır
3. **Admin:** Kayıtları seç → ilgili personele topluca ata
4. **Personel:** Telefonundan `/personel` sayfasını açar, kendine atanan kayıtları görür,
   birine dokunup **tam EWO formunu** (arıza türü, zaman çizelgesi, 5 neden analizi, önlemler, sonuç)
   doldurur, "Tamamla ve Gönder" der → kayıt "Onay Bekliyor" durumuna geçer
5. **Admin:** `/admin` üzerinden "İncele" ile formu görüntüler, **Onayla** veya **Personele Geri Gönder** der
6. **Admin/Personel:** İstediği an "PDF Olarak Görüntüle/İndir" ile formu orijinal EWO (F13-31) formatında
   yazdırılabilir görünümde açar, tarayıcının "Yazdır > PDF olarak kaydet" seçeneğiyle indirir

## Sonraki Aşamalar (yol haritası)
- [ ] Telegram bot ile yeni atama bildirimi (senin AnKA GLC botunla entegre edilebilir)
- [ ] Pareto/KPI dashboard sayfası (mevcut bakim_panel.html mantığıyla) — kök neden türü,
      kategori (MA/BA/KA/RA) ve tezgah bazında toplam duruş süresi analizleri
- [ ] Excel'e geri dışa aktarma (raporlama için)
- [ ] Gerçek PWA ikonları (public/icon-192.png, icon-512.png ekle)

## Notlar
- `service_role` key çok güçlü bir anahtardır, sadece sunucu tarafında (.env.local, Vercel env vars)
  kullanılır, asla frontend koduna veya GitHub'a commit edilmemelidir (.gitignore'da .env.local var).
- Mükerrer kayıt kontrolü TEZGAH + BAŞLANGIÇ + DURUŞ KODU + İŞ EMRİ DETAY KODU + SÜRE kombinasyonuyla yapılır.
  ERP export formatı değişirse `app/api/import/route.ts` içindeki `COLS` dizisini güncelle.
