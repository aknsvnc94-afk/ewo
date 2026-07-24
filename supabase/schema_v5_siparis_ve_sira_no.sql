-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v5
-- Bu dosyayı Supabase SQL Editor'de, v1-v4'ten SONRA çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1) İŞ EMRİ SIRA NUMARASI (2026-1, 2026-2, ... şeklinde, otomatik artan)
-- ------------------------------------------------------------
alter table ariza_kayitlari add column if not exists sira_no text unique;

create sequence if not exists ariza_sira_seq start 1;

create or replace function ariza_sira_no_ata() returns trigger as $$
begin
  if new.sira_no is null then
    new.sira_no := to_char(now(), 'YYYY') || '-' || nextval('ariza_sira_seq');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ariza_sira_no on ariza_kayitlari;
create trigger trg_ariza_sira_no
  before insert on ariza_kayitlari
  for each row execute function ariza_sira_no_ata();

-- Mevcut (zaten sistemde olan) kayıtlara da geriye dönük sıra numarası ata
-- (oluşturulma tarihine göre sıralı şekilde)
do $$
declare
  r record;
begin
  for r in (select id from ariza_kayitlari where sira_no is null order by created_at asc)
  loop
    update ariza_kayitlari set sira_no = to_char(now(), 'YYYY') || '-' || nextval('ariza_sira_seq') where id = r.id;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2) SİPARİŞ / MALZEME TAKİP TABLOLARI
-- ------------------------------------------------------------
create table if not exists siparisler (
  id uuid primary key default gen_random_uuid(),
  dosya_adi text,
  pdf_url text,
  ham_metin text,
  talep_no text,
  tarih text,
  bolum text,
  kisi text,
  yuklenme_tarihi timestamptz not null default now(),
  yukleyen_id uuid references personel(id) on delete set null
);

create table if not exists siparis_kalemleri (
  id uuid primary key default gen_random_uuid(),
  siparis_id uuid not null references siparisler(id) on delete cascade,
  sira int not null default 0,
  satir_metni text not null,
  stok_kodu text,
  miktar text,
  teslim_tarihi text,
  alindi boolean not null default false,
  alan_personel_id uuid references personel(id) on delete set null,
  alinma_tarihi timestamptz
);

create index if not exists idx_siparis_kalem_siparis on siparis_kalemleri(siparis_id);
create index if not exists idx_siparis_kalem_alindi on siparis_kalemleri(alindi);

alter table siparisler enable row level security;
alter table siparis_kalemleri enable row level security;

-- ------------------------------------------------------------
-- 3) Aksiyonlara "manuel" tipi ekleniyor (ERP kaydı olmadan admin'in
--    doğrudan personele açtığı aksiyonlar için)
-- ------------------------------------------------------------
alter table aksiyonlar drop constraint if exists aksiyonlar_tip_check;
alter table aksiyonlar add constraint aksiyonlar_tip_check
  check (tip in ('kok_neden', 'sifir_ariza', 'manuel'));
