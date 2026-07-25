-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v8
-- Bu dosyayı Supabase SQL Editor'de, v1-v7'den SONRA çalıştırın.
-- ============================================================

-- Günlük "açık iş emirleri" Excel dökümünden gelen kayıtlar için ayrı tablo
-- (mevcut ERP arıza importundan (ariza_kayitlari) bağımsız bir takip sistemi).
create table if not exists is_emirleri (
  id uuid primary key default gen_random_uuid(),
  is_emri_no text unique,
  onarilan_kodu text,
  onarilan_tanimi text,
  problem_tanimi text,
  tarih timestamptz,
  tesis_adi text,

  atanan_personel_id uuid references personel(id) on delete set null,
  atama_tarihi timestamptz,

  durum text not null default 'Açık' check (durum in ('Açık', 'Kapatıldı')),
  yapilan_is text,
  kapatma_tarihi timestamptz,
  kapatan_personel_id uuid references personel(id) on delete set null,

  yuklenme_tarihi timestamptz not null default now(),
  yukleyen_id uuid references personel(id) on delete set null
);

create index if not exists idx_is_emri_atanan on is_emirleri(atanan_personel_id);
create index if not exists idx_is_emri_durum on is_emirleri(durum);

alter table is_emirleri enable row level security;
-- Not: diğer tablolarda olduğu gibi tüm erişim service_role ile API route'ları üzerinden yapılır.
