# Bakım Yönetim Sistemi (Web)

Çoklu fabrika desteğiyle çalışan bakım yönetim platformu: ERP arıza kayıtlarını
yükleme, personele atama ve personelin mobil/PC üzerinden detay (aksiyon, kök
neden, tamamlanma durumu) doldurmasını sağlar. Telefonda "ana ekrana ekle" ile
uygulama gibi çalışır (PWA).

Her fabrikanın verisi (personel, arıza kayıtları, iş emirleri, siparişler,
aksiyonlar) birbirinden tamamen izole — giriş ekranında kullanıcı önce
fabrikasını seçer. Ayrıca tüm fabrikalardaki personeli yönetebilen bir
**Süper Admin** rolü de mevcuttur.

## Mimari
- **Frontend:** Next.js 14 (App Router) + PWA
- **Backend:** Next.js API Routes
- **Veritabanı:** Supabase (Postgres)
- **Giriş:** Fabrika seçimi + Kullanıcı adı + PIN (imzalı cookie ile 30 gün oturum)
- **Barındırma:** Vercel (frontend) + Supabase (veritabanı) — ikisi de ücretsiz planla başlar

## Kurulum Adımları

### 1) Supabase projesi oluştur
1. https://supabase.com üzerinde yeni proje aç
2. SQL Editor'e girip şu sırayla çalıştır:
   - `supabase/schema.sql`
   - `supabase/schema_v2_ewo_form.sql`
   - `supabase/schema_v3_guncelleme.sql`
   - `supabase/schema_v4_aksiyonlar.sql`
   - `supabase/schema_v5_siparis_ve_sira_no.sql`
   - `supabase/schema_v6_siparis_onay.sql` (opsiyonel, artık kullanılmıyor ama zararsız)
   - `supabase/schema_v7_genel_tesis.sql`
   - `supabase/schema_v8_is_emirleri.sql`
   - `supabase/schema_v9_giris_guvenligi.sql`
   - `supabase/schema_v10_fabrikalar.sql` (çoklu fabrika desteği — mevcut tüm
   - `supabase/schema_v11_gelistirmeler.sql`
   - `supabase/schema_v12_makine_kodu_esleme.sql`
   - `supabase/schema_v13_silme_izinleri.sql`
   - `supabase/schema_v14_kalip_baski.sql` (MSBF için kalıp baskı sayısı tablosu)
   - `supabase/schema_v15_msbf_gelistirmeler.sql`
   - `supabase/schema_v16_kumulatif_duzeltme.sql`
   - `supabase/schema_v17_yt_baski_nullable.sql`
   - `supabase/schema_v18_msbf_taban.sql`
   - `supabase/schema_v19_proje_kaliplari.sql`
   - `supabase/schema_v20_siparis_kalem_sutunlari.sql` (sipariş PDF: stok adı + açıklama sütunları)
   - `supabase/schema_v21_bolumler.sql` (bölüm bazlı yapı: bakım / kalite / üretim)
     veri geriye dönük olarak "Plaskar" fabrikasına atanır)
3. İlk fabrikanı (Plaskar zaten `schema_v10` ile otomatik oluşuyor) veya yeni bir
   fabrika daha eklemek istersen:
   ```sql
   insert into fabrikalar (ad, kod) values ('Yeni Fabrika A.Ş.', 'yeni-fabrika') returning id;
   ```
   O fabrikaya admin ekle (PIN'i kendi belirlediğinle değiştir, `fabrika_id`'yi
   yukarıdaki `insert`'ten dönen id ile değiştir — Plaskar için sabit id
   `00000000-0000-0000-0000-000000000001`):
   ```sql
   insert into personel (ad_soyad, kullanici_adi, pin_hash, rol, fabrika_id)
   values ('Akın Sevinç', 'akin', crypt('SENIN_SIFREN', gen_salt('bf')), 'admin', '00000000-0000-0000-0000-000000000001');
   ```
   Tüm fabrikalardaki personeli tek yerden yönetebilen bir **süper admin**
   eklemek istersen (`fabrika_id` bilerek `null` bırakılır):
   ```sql
   insert into personel (ad_soyad, kullanici_adi, pin_hash, rol, fabrika_id)
   values ('Akın Sevinç', 'superadmin', crypt('SENIN_SIFREN', gen_salt('bf')), 'superadmin', null);
   ```
   (Diğer personelleri artık `/admin/personel` sayfasından, SQL yazmadan ekleyebilir/düzenleyebilir/silebilirsin.)
4. Settings > API sayfasından `Project URL` ve `service_role`/`secret` key'i kopyala
5. **Storage bucket oluştur (fotoğraf yüklemeleri için):**
   - Sol menüden **Storage** → **New bucket**
   - İsim: `cozum-resimleri`
   - **Public bucket** seçeneğini AÇIK bırak (fotoğrafların görüntülenebilmesi için gerekli)
   - Create
6. **İkinci Storage bucket'ı oluştur (sipariş PDF'leri için):**
   - Storage → New bucket
   - İsim: `siparis-pdfler`
   - **Public bucket** seçeneğini AÇIK bırak
   - Create

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
0. **Giriş:** Herkes önce fabrikasını seçer, sonra kullanıcı adı + şifre girer.
   Süper admin hesapları listenin altındaki "Süper Admin" seçeneğiyle, fabrika
   seçmeden giriş yapar ve doğrudan `/admin/personel`'e (tüm fabrikalardaki
   personel listesi) yönlendirilir.
1. **Admin (sen):** `/admin/personel` sayfasından bakım personeline kullanıcı adı + şifre tanımla
   (düzenleme, şifre sıfırlama, pasif yapma ve silme seçenekleri de burada)
2. **Admin:** ERP'den Excel export al → `/admin` sayfasından yükle (tarayıcıda parse edilir,
   4.5MB sunucu sınırına takılmaz), MA/BA/KA/RA'ya otomatik ayrılır, mükerrer kayıtlar atlanır
3. **Admin:** Kayıtları filtrele/sırala (tarih, süre, tezgah), seç → personele topluca ata
4. **Personel:** `/personel`'de kendine atanan kayıtları ve özet sayılarını (toplam/bekleyen/
   onay bekleyen/onaylı) görür. Bir kayda dokunduğunda:
   - **20 dakikadan KISA duruşlarda:** sadece "Tamamlandı" işaretler, form yok
   - **20 dakikadan UZUN duruşlarda:** Arıza Türü + Arızanın Tanımı + Direk Sebep ve Çözümü
     (en az 10 karakter, boş bırakılamaz) + isteğe bağlı fotoğraf ekler, "Tamamla ve Gönder" der
     → kayıt "Onay Bekliyor" durumuna geçer
5. **Admin:** `/admin` üzerinden "İncele" ile (sadece 20dk üzeri kayıtlarda görünür) zaman
   çizelgesi, 5 Neden analizi, Kök Sebep Tipi (Çalışma koşullarının izlenmemesi / Proje
   zayıflığı / Dış etkenler / Temel şartların eksikliği / Yetersiz bakım / Eksik beceri-yetkinlik),
   önlemler (her satırda **personel listesinden Sorumlu seçilir**) ve sonucu doldurur;
   "Üretim Başlangıcını Hesapla" ile bitiş saatini arıza başlangıcı + süreden otomatik alabilir.
   Sonra **Onaylar** veya **Personele geri gönderir**
6. **Admin/Personel:** "PDF Görüntüle/İndir" ile formu orijinal EWO (F13-31) formatında
   yazdırılabilir görünümde açar, tarayıcının "Yazdır > PDF olarak kaydet" seçeneğiyle indirir
7. **Admin:** Ana panelde personel bazlı atanan iş sayısı grafiğini görür
8. **Aksiyon Takip (`/admin/aksiyonlar`, personel için `/personel/aksiyonlar`):** Önlem
   tablolarında sorumlu atanan her satır burada ayrı bir görev olarak izlenir. Personel işini
   bitirince "Kapat" der, not girer → admin onayına düşer. Admin onaylar ya da geri gönderir.
   Termin tarihi geçmiş ve hâlâ kapatılmamış aksiyonlar **kırmızı**, diğerleri **yeşil** kenarlıkla
   gösterilir; üstte toplam/açık/onay bekleyen/kapatılan/gecikmiş sayıları görünür.
9. **EWO Analiz / Pareto (`/admin/analiz`):** MA / KA / BA / RA olmak üzere 4 ayrı bölüm.
   Her bölümde sadece 20dk üzeri (EWO gerektiren) arızalar dahil edilir: MA/BA/RA için **tezgah**
   bazında, KA için **kalıp kodu** bazında Pareto grafiği + açık/kapalı EWO sayıları + **kök neden
   dağılımı grafiği** gösterilir.
10. **Sıra Numarası:** Her arıza kaydına otomatik olarak "2026-1", "2026-2" ... şeklinde artan bir
    sıra numarası atanır (veritabanı tetikleyicisiyle), ERP'nin kendi iş emri numarası (İş Emri
    Detay Kodu) da ayrı bir sütunda yanında görünür.
11. **Manuel Kayıt (`/admin/yeni-kayit`):** ERP'den gelmeyen arızalar/görevler için admin doğrudan
    kayıt açabilir, personel atayabilir ve aksiyon tanımlayabilir.
12. **Sipariş Takip (`/admin/siparisler`):** ERP'den açılan "Satınalma Talep Formu" PDF'i yüklenir,
    sistem Talep No / Tarih / Bölüm / Kişi bilgilerini ve her kalemi (Stok Kodu, Açıklama, Miktar,
    Teslim Tarihi) otomatik ayrıştırır. Personel `/personel/malzemeler` sayfasından malzemeyi
    "Alındı" işaretler (tarih/saat otomatik kaydedilir). Teslim tarihi geçmiş ve hâlâ alınmamış
    kalemler kırmızı gösterilir.

**Not:** PDF ayrıştırma mantığı, gönderdiğiniz örnek "Satınalma Talep Formu" düzenine göre
kalibre edildi (stok kodu deseni: 2-6 harf + 6-10 rakam, örn. BYP20260763). Farklı bir ERP şablonu
kullanırsanız, `app/api/siparis/upload/route.ts` içindeki `STOK_KODU_DESENI` ve `DETAY_DESENI`
regex'lerinin güncellenmesi gerekebilir.

13. **İş Emirleri (`/admin/is-emirleri`, personel için `/personel/is-emirleri`):** Günlük "açık iş
    emirleri" Excel dökümünü (başlıksız, sabit sütunlu format) admin yükler — sistem İş Emri No,
    Onarılan Kodu, Onarılan Tanımı, Problem Tanımı, Tarih ve Tesis Adı'nı otomatik çıkarır.
    Admin bu iş emirlerini personele atar; personel kendi sayfasından yaptığı işi yazıp
    **"İşi Bitir ve Kapat"** der — kapanma tarihi/saati ve kapatan kişi otomatik kaydedilir.
    Mükerrer iş emri numaraları (aynı dosya tekrar yüklense bile) otomatik atlanır.

**Not:** İş emri Excel formatının hiç başlık satırı yok, sütunlar sabit pozisyonda okunuyor
(`lib/isEmriParse.ts` içindeki `SUTUN` sabitleri: Onarılan Kodu=3, Onarılan Tanımı=4,
Problem Tanımı=5, Tarih=6, İş Emri No=7, Tesis Adı=31). ERP'niz farklı bir sütun sırası
üretirse bu sabitlerin güncellenmesi gerekir.

## Sonraki Aşamalar (yol haritası)
- [ ] Telegram bot ile yeni atama bildirimi (senin AnKA GLC botunla entegre edilebilir)
- [ ] Pareto/KPI dashboard sayfası — kök neden türü, kategori (MA/BA/KA/RA) ve tezgah
      bazında toplam duruş süresi analizleri
- [ ] Excel'e geri dışa aktarma (raporlama için)
- [ ] Gerçek PWA ikonları (public/icon-192.png, icon-512.png ekle)

## Notlar
- `service_role` key çok güçlü bir anahtardır, sadece sunucu tarafında (.env.local, Vercel env vars)
  kullanılır, asla frontend koduna veya GitHub'a commit edilmemelidir (.gitignore'da .env.local var).
- Mükerrer kayıt kontrolü TEZGAH + BAŞLANGIÇ + DURUŞ KODU + İŞ EMRİ DETAY KODU + SÜRE kombinasyonuyla yapılır.
  ERP export formatı değişirse `app/api/import/route.ts` içindeki `COLS` dizisini güncelle.
