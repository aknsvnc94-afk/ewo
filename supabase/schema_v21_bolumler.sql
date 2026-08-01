-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v21
-- Bölüm bazlı yapı: her personel bir bölüme bağlanır.
-- Yetki kuralı: personel TÜM bölümleri görüntüleyebilir, ancak yalnızca
-- kendi bölümünde işlem (ekleme/güncelleme/silme) yapabilir.
-- Süper admin her bölümde işlem yapabilir.
-- Bu dosyayı Supabase SQL Editor'de, v1-v20'den SONRA çalıştırın.
-- ============================================================

-- Mevcut tüm personel varsayılan olarak "bakim" bölümüne atanır;
-- kalite/üretim personelini sonradan Personel Yönetimi ekranından değiştirin.
alter table personel add column if not exists bolum text not null default 'bakim';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'personel_bolum_check'
  ) then
    alter table personel add constraint personel_bolum_check
      check (bolum in ('bakim', 'kalite', 'uretim'));
  end if;
end $$;

create index if not exists idx_personel_bolum on personel(fabrika_id, bolum);

-- Giriş fonksiyonu bölüm bilgisini de döndürmeli.
-- Dönüş tipi değiştiği için önce düşürülmesi gerekiyor (create or replace yetmez).
-- Gövde, v10'daki mantığın birebir aynısıdır; yalnızca "bolum" alanı eklenmiştir.
drop function if exists personel_giris(text, text, uuid);

create function personel_giris(p_kullanici_adi text, p_pin text, p_fabrika_id uuid)
returns table(id uuid, ad_soyad text, rol text, fabrika_id uuid, bolum text) as $$
begin
  return query
    select p.id, p.ad_soyad, p.rol, p.fabrika_id, p.bolum
    from personel p
    where p.kullanici_adi = lower(p_kullanici_adi)
      and p.pin_hash = crypt(p_pin, p.pin_hash)
      and p.aktif = true
      and p.fabrika_id is not distinct from p_fabrika_id;
end;
$$ language plpgsql security definer;

-- Personel ekleme fonksiyonuna bölüm parametresi (varsayılan: bakim)
create or replace function personel_ekle(
  p_ad_soyad text, p_kullanici_adi text, p_sifre text, p_rol text default 'personel',
  p_fabrika_id uuid default null, p_bolum text default 'bakim'
)
returns table(id uuid) as $$
begin
  return query
    insert into personel (ad_soyad, kullanici_adi, pin_hash, rol, fabrika_id, bolum)
    values (p_ad_soyad, lower(trim(p_kullanici_adi)), crypt(p_sifre, gen_salt('bf')), p_rol, p_fabrika_id, p_bolum)
    returning personel.id;
end;
$$ language plpgsql security definer;
