-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v4
-- Bu dosyayı Supabase SQL Editor'de, v1-v2-v3'ten SONRA çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1) AKSİYONLAR TABLOSU
-- EWO formundaki "Önlemler" tablolarından (kök nedene karşı / sıfır arıza)
-- personele atanan her satır, buradan ayrıca izlenebilir bir görev haline gelir.
-- ------------------------------------------------------------
create table if not exists aksiyonlar (
  id uuid primary key default gen_random_uuid(),
  ariza_kayit_id uuid not null references ariza_kayitlari(id) on delete cascade,
  tip text not null check (tip in ('kok_neden', 'sifir_ariza')),
  sira int not null default 0,
  aciklama text not null,
  sorumlu_personel_id uuid references personel(id) on delete set null,
  plan_tarihi date,
  durum text not null default 'Açık' check (durum in ('Açık', 'Onay Bekliyor', 'Kapatıldı')),
  kapatma_aciklamasi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_aksiyon_kayit on aksiyonlar(ariza_kayit_id);
create index if not exists idx_aksiyon_sorumlu on aksiyonlar(sorumlu_personel_id);
create index if not exists idx_aksiyon_durum on aksiyonlar(durum);

drop trigger if exists trg_aksiyon_updated_at on aksiyonlar;
create trigger trg_aksiyon_updated_at
  before update on aksiyonlar
  for each row execute function set_updated_at();

alter table aksiyonlar enable row level security;
-- Not: Diğer tablolarda olduğu gibi, tüm erişim Next.js API route'ları
-- üzerinden service_role key ile yapılır (RLS bypass edilir).
