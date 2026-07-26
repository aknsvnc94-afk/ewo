-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v11
-- 7 maddelik geliştirme paketi: EWO alan ayrımı, makine bazlı yedek parça
-- Bu dosyayı Supabase SQL Editor'de, v1-v10'dan SONRA çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Personel EWO formu: "Direk Sebep ve Çözümü" ikiye ayrılıyor.
-- Mevcut direk_sebep_cozum sütunu bundan sonra sadece "Direk Sebep" anlamına
-- gelir (admin'in 5N analizindeki ayrı direk_sebep sütunuyla karışmaz), yeni
-- cozum sütunu "Çözüm" kısmını tutar.
-- ------------------------------------------------------------
alter table ariza_kayitlari add column if not exists cozum text;

-- ------------------------------------------------------------
-- 2) MAKİNE BAZLI YEDEK PARÇA MODÜLÜ
-- ------------------------------------------------------------
create table if not exists makineler (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  ad text not null,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (fabrika_id, ad)
);
create index if not exists idx_makine_fabrika on makineler(fabrika_id);
alter table makineler enable row level security;

-- Sadece manuel eklenen (siparişten bağımsız) yedek parçalar burada tutulur.
-- Siparişten gelen parçalar siparis_kalemleri.makine_id üzerinden okunur,
-- ayrıca kopyalanmaz.
create table if not exists yedek_parcalar (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  makine_id uuid not null references makineler(id) on delete cascade,
  parca_kodu text,
  parca_tanimi text not null,
  ekleyen_personel_id uuid references personel(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_yedek_parca_makine on yedek_parcalar(makine_id);
create index if not exists idx_yedek_parca_fabrika on yedek_parcalar(fabrika_id);
alter table yedek_parcalar enable row level security;

alter table siparis_kalemleri add column if not exists makine_id uuid references makineler(id);
create index if not exists idx_siparis_kalem_makine on siparis_kalemleri(makine_id);
