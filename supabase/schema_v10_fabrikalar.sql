-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v10
-- Çoklu fabrika (multi-tenant) desteği + superadmin rolü
-- Bu dosyayı Supabase SQL Editor'de, v1-v9'dan SONRA çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1) FABRİKALAR TABLOSU
-- ------------------------------------------------------------
create table if not exists fabrikalar (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  kod text unique not null,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bugüne kadar sistemde tek fabrika (Plaskar) vardı; tüm geçmiş veriyi
-- geriye dönük olarak buna bağlıyoruz. Sabit id kullanıyoruz ki aşağıdaki
-- adımlarda tekrar tekrar referans verebilelim.
insert into fabrikalar (id, ad, kod)
values ('00000000-0000-0000-0000-000000000001', 'Plaskar', 'plaskar')
on conflict (id) do nothing;

alter table fabrikalar enable row level security;
-- Not: diğer tablolarda olduğu gibi tüm erişim service_role ile API route'ları üzerinden yapılır.

-- ------------------------------------------------------------
-- 2) PERSONEL: fabrika_id (NULLABLE — null = superadmin, hiçbir fabrikaya bağlı değil)
-- ------------------------------------------------------------
alter table personel add column if not exists fabrika_id uuid references fabrikalar(id);
update personel set fabrika_id = '00000000-0000-0000-0000-000000000001' where fabrika_id is null;
create index if not exists idx_personel_fabrika on personel(fabrika_id);

-- kullanici_adi artık global değil, fabrika bazında benzersiz (farklı fabrikalar
-- aynı kullanıcı adını kullanabilir). superadmin'ler (fabrika_id null) için ayrı
-- bir partial unique index gerekiyor çünkü normal unique kısıt NULL'ları
-- birbirinden farklı sayar.
alter table personel drop constraint if exists personel_kullanici_adi_key;
alter table personel add constraint personel_fabrika_kullanici_adi_key unique (fabrika_id, kullanici_adi);
create unique index if not exists personel_kullanici_adi_superadmin_uniq
  on personel(kullanici_adi) where fabrika_id is null;

alter table personel drop constraint if exists personel_rol_check;
alter table personel add constraint personel_rol_check check (rol in ('admin','personel','superadmin'));

-- ------------------------------------------------------------
-- 3) OPERASYONEL TABLOLAR: fabrika_id (NOT NULL)
-- ------------------------------------------------------------
alter table ariza_kayitlari add column if not exists fabrika_id uuid references fabrikalar(id);
update ariza_kayitlari set fabrika_id = '00000000-0000-0000-0000-000000000001' where fabrika_id is null;
alter table ariza_kayitlari alter column fabrika_id set not null;
create index if not exists idx_ariza_fabrika on ariza_kayitlari(fabrika_id);

alter table ariza_kayitlari drop constraint if exists ariza_kayitlari_unique_key_key;
alter table ariza_kayitlari add constraint ariza_kayitlari_fabrika_unique_key_key unique (fabrika_id, unique_key);

alter table is_emirleri add column if not exists fabrika_id uuid references fabrikalar(id);
update is_emirleri set fabrika_id = '00000000-0000-0000-0000-000000000001' where fabrika_id is null;
alter table is_emirleri alter column fabrika_id set not null;
create index if not exists idx_is_emri_fabrika on is_emirleri(fabrika_id);

alter table is_emirleri drop constraint if exists is_emirleri_is_emri_no_key;
alter table is_emirleri add constraint is_emirleri_fabrika_is_emri_no_key unique (fabrika_id, is_emri_no);

alter table siparisler add column if not exists fabrika_id uuid references fabrikalar(id);
update siparisler set fabrika_id = '00000000-0000-0000-0000-000000000001' where fabrika_id is null;
alter table siparisler alter column fabrika_id set not null;
create index if not exists idx_siparis_fabrika on siparisler(fabrika_id);

-- aksiyonlar ve siparis_kalemleri: denormalize edilmiş fabrika_id (ebeveyn
-- tablodan kopyalanır) — child sorgularında join yapmadan tek .eq() ile
-- filtrelenebilsin diye.
alter table aksiyonlar add column if not exists fabrika_id uuid references fabrikalar(id);
update aksiyonlar a set fabrika_id = k.fabrika_id
  from ariza_kayitlari k where a.ariza_kayit_id = k.id and a.fabrika_id is null;
alter table aksiyonlar alter column fabrika_id set not null;
create index if not exists idx_aksiyon_fabrika on aksiyonlar(fabrika_id);

alter table siparis_kalemleri add column if not exists fabrika_id uuid references fabrikalar(id);
update siparis_kalemleri sk set fabrika_id = s.fabrika_id
  from siparisler s where sk.siparis_id = s.id and sk.fabrika_id is null;
alter table siparis_kalemleri alter column fabrika_id set not null;
create index if not exists idx_siparis_kalem_fabrika on siparis_kalemleri(fabrika_id);

-- ------------------------------------------------------------
-- 4) RPC GÜNCELLEMELERİ
-- ------------------------------------------------------------

-- Giriş: artık fabrika_id de eşleşmeli. superadmin girişinde p_fabrika_id NULL
-- gönderilir; "is not distinct from" NULL=NULL eşleşmesini doğru yönetir.
create or replace function personel_giris(p_kullanici_adi text, p_pin text, p_fabrika_id uuid)
returns table(id uuid, ad_soyad text, rol text, fabrika_id uuid) as $$
begin
  return query
    select p.id, p.ad_soyad, p.rol, p.fabrika_id
    from personel p
    where p.kullanici_adi = lower(p_kullanici_adi)
      and p.pin_hash = crypt(p_pin, p.pin_hash)
      and p.aktif = true
      and p.fabrika_id is not distinct from p_fabrika_id;
end;
$$ language plpgsql security definer;

-- Personel ekleme: fabrika_id eklendi (superadmin oluştururken NULL geçilir).
create or replace function personel_ekle(
  p_ad_soyad text, p_kullanici_adi text, p_sifre text, p_rol text default 'personel',
  p_fabrika_id uuid default null
)
returns table(id uuid) as $$
begin
  return query
    insert into personel (ad_soyad, kullanici_adi, pin_hash, rol, fabrika_id)
    values (p_ad_soyad, lower(trim(p_kullanici_adi)), crypt(p_sifre, gen_salt('bf')), p_rol, p_fabrika_id)
    returning personel.id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 5) Örnek: yeni fabrika + ilk admin + ilk superadmin ekleme
-- (README.md'de de açıklanıyor)
-- ------------------------------------------------------------
-- insert into fabrikalar (ad, kod) values ('Yeni Fabrika A.Ş.', 'yeni-fabrika') returning id;
-- insert into personel (ad_soyad, kullanici_adi, pin_hash, rol, fabrika_id)
--   values ('Fabrika Admini', 'admin', crypt('SIFRE', gen_salt('bf')), 'admin', '<yukarıdaki id>');
-- insert into personel (ad_soyad, kullanici_adi, pin_hash, rol, fabrika_id)
--   values ('Akın Sevinç', 'superadmin', crypt('SIFRE', gen_salt('bf')), 'superadmin', null);
