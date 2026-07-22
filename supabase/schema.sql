-- ============================================================
-- EWO TAKİP SİSTEMİ - Supabase Şema
-- Plaskar Plastik Enjeksiyon Otomotiv - Bakım Arıza Takip
-- ============================================================

-- pgcrypto: PIN hashleme için
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) PERSONEL TABLOSU
-- ------------------------------------------------------------
create table if not exists personel (
  id uuid primary key default gen_random_uuid(),
  ad_soyad text not null,
  kullanici_adi text unique not null,      -- örn: "akin.sevinc"
  pin_hash text not null,                  -- 4-6 haneli PIN'in bcrypt hash'i
  rol text not null default 'personel' check (rol in ('admin','personel')),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) ARIZA KAYITLARI TABLOSU (ANA VERI formatı + atama/detay alanları)
-- ------------------------------------------------------------
create table if not exists ariza_kayitlari (
  id uuid primary key default gen_random_uuid(),

  -- composite dedup key: ERP'den tekrar aynı satır gelirse üzerine yazmamak için
  unique_key text unique not null,

  -- ANA VERI sütunları (ERP export)
  tezgah text,
  vardiya int,
  is_emri_detay_kodu text,
  stok_kodu text,
  kalip_kodu text,
  operator text,
  durus_tipi text,
  durus_kodu text,              -- MA / BA / KA / RA -> kategori bunun üzerinden belirlenir
  durus_adi text,
  baslangic timestamptz,
  bitis timestamptz,
  sure_sn numeric,
  sure text,
  durus_maks numeric,
  durus_maks_asim_sn numeric,
  durus_maks_asim text,
  aciklama text,
  utarih text,
  tesis text,

  -- Türetilmiş
  kategori text check (kategori in ('MA','BA','KA','RA')),

  -- Personel tarafından doldurulacak detay alanları
  aksiyon text,
  aksiyon_sorumlusu_id uuid references personel(id),
  hedef_tarih date,
  tamamlanma_durumu text default 'Beklemede'
      check (tamamlanma_durumu in ('Beklemede','Devam Ediyor','Tamamlandı','İptal')),
  kok_neden_turu text,

  -- Atama (admin tarafından kime atandığı)
  atanan_personel_id uuid references personel(id),
  atama_tarihi timestamptz,

  -- İçe aktarma bilgisi
  yuklenme_tarihi timestamptz not null default now(),
  yukleyen_id uuid references personel(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ariza_kategori on ariza_kayitlari(kategori);
create index if not exists idx_ariza_atanan on ariza_kayitlari(atanan_personel_id);
create index if not exists idx_ariza_durum on ariza_kayitlari(tamamlanma_durumu);
create index if not exists idx_ariza_baslangic on ariza_kayitlari(baslangic);

-- updated_at otomatik güncelleme
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ariza_updated_at on ariza_kayitlari;
create trigger trg_ariza_updated_at
  before update on ariza_kayitlari
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 3) PIN İLE GİRİŞ (RPC) - basit ve telefon dostu
-- ------------------------------------------------------------
create or replace function personel_giris(p_kullanici_adi text, p_pin text)
returns table(id uuid, ad_soyad text, rol text) as $$
begin
  return query
    select p.id, p.ad_soyad, p.rol
    from personel p
    where p.kullanici_adi = lower(p_kullanici_adi)
      and p.pin_hash = crypt(p_pin, p.pin_hash)
      and p.aktif = true;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 4) Örnek admin kullanıcı ekleme (PIN: 1234 -> DEĞİŞTİRİLMELİ)
-- Kendi kullanıcılarınızı eklerken:
-- insert into personel (ad_soyad, kullanici_adi, pin_hash, rol)
-- values ('Akın Sevinç', 'akin.sevinc', crypt('1234', gen_salt('bf')), 'admin');
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 5) RLS (Row Level Security) - service_role ile backend'den erişileceği için
--    API rotalarımız service_role key kullanacak, RLS'i basit tutuyoruz.
-- ------------------------------------------------------------
alter table personel enable row level security;
alter table ariza_kayitlari enable row level security;

-- Not: Tüm okuma/yazma işlemleri Next.js API route'ları üzerinden
-- service_role key ile yapılacağı için burada public policy AÇMIYORUZ.
-- (service_role RLS'i bypass eder, bu güvenlik açısından doğru yaklaşımdır.)
