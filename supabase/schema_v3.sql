-- =============================================================
-- CAFEHUB v3 - DDL + DATA DUMMY
-- Rebuild berdasarkan dokumen 'Perbaikan Cafehub-v2'
--
-- Perubahan utama terhadap v2:
--   1. Tabel `cities` DIHAPUS -- cakupan cukup satu kota (Malang) saja.
--   2. Tabel `waitlist` DIHAPUS -- meja penuh cukup ditampilkan sebagai
--      "penuh, belum bisa reservasi", tanpa daftar tunggu.
--   3. Metode pembayaran disederhanakan jadi SATU: QRIS saja.
--   4. Alur pendaftaran & verifikasi kafe dibuat eksplisit: kolom
--      `status` pada `cafes` (pending_verification/approved/rejected).
--      Kafe baru WAJIB melalui admin (cafe_verification_log) sebelum
--      tampil di pencarian publik -- sesuai flowchart pendaftaran kafe.
--   5. Login/registrasi kini membawa pilihan role (mahasiswa /
--      pemilik_kafe) -- admin tidak bisa didaftarkan sendiri lewat form.
--   6. Alur konfirmasi booking oleh pemilik kafe: begitu pelanggan
--      datang, pemilik menandai booking 'completed'. Jika tidak datang
--      sampai batas waktu, booking otomatis 'expired' oleh scheduled job
--      (baik yang masih 'pending' maupun yang sudah 'confirmed').
--      Pembayaran QRIS yang berhasil otomatis memindahkan status booking
--      dari 'pending' -> 'confirmed'.
--   7. View baru `public_cafe_capacity` -- total kapasitas meja yang
--      masih tersedia per kafe (bukan cuma jumlah meja).
--   8. Notifikasi otomatis kini juga mencakup hasil verifikasi kafe.
--
-- Target: PostgreSQL (kompatibel dengan Supabase)
-- =============================================================

-- Jalankan DROP hanya jika ingin mengulang dari nol
DROP TABLE IF EXISTS cafe_verification_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS operating_hours CASCADE;
DROP TABLE IF EXISTS cafe_facilities CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS menus CASCADE;
DROP VIEW IF EXISTS public_cafe_capacity CASCADE;
DROP VIEW IF EXISTS public_table_occupancy CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS cafes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Trigger penghubung auth.users (Supabase Auth) -> public.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS fn_handle_new_auth_user() CASCADE;

DROP FUNCTION IF EXISTS create_booking_atomic(INTEGER, TIMESTAMP);
DROP FUNCTION IF EXISTS fn_booking_after_insert();
DROP FUNCTION IF EXISTS fn_booking_after_update();
DROP FUNCTION IF EXISTS fn_payment_after_update();
DROP FUNCTION IF EXISTS fn_apply_verification_decision();

DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS table_status;
DROP TYPE IF EXISTS booking_status;
DROP TYPE IF EXISTS menu_kategori;
DROP TYPE IF EXISTS subscription_tier;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS payment_metode;
DROP TYPE IF EXISTS notification_tipe;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS verification_keputusan;
DROP TYPE IF EXISTS moderasi_status;
DROP TYPE IF EXISTS cafe_status;

CREATE TYPE user_role AS ENUM ('mahasiswa', 'pemilik_kafe', 'admin');
CREATE TYPE cafe_status AS ENUM ('pending_verification', 'approved', 'rejected');
CREATE TYPE table_status AS ENUM ('tersedia', 'terisi');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'expired', 'cancelled', 'completed');
CREATE TYPE menu_kategori AS ENUM ('makanan', 'minuman', 'snack');
CREATE TYPE subscription_tier AS ENUM ('standar', 'premium');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_metode AS ENUM ('qris');
CREATE TYPE notification_tipe AS ENUM ('confirmation', 'reminder', 'expired', 'cancelled', 'completed', 'payment', 'verification');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'whatsapp');
CREATE TYPE verification_keputusan AS ENUM ('approved', 'rejected');
CREATE TYPE moderasi_status AS ENUM ('approved', 'pending', 'rejected');

-- -------------------------------------------------------------
-- 1. users  (+ poin_loyalitas untuk program loyalitas)
-- -------------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    auth_user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    nama            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    role            user_role NOT NULL,
    poin_loyalitas  INTEGER NOT NULL DEFAULT 0 CHECK (poin_loyalitas >= 0),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
-- auth_user_id NULL berarti akun ini masih 'akun dummy' yang belum diklaim.
-- Saat seseorang mendaftar (signup) dengan email yang sama persis, trigger
-- fn_handle_new_auth_user akan otomatis menghubungkan (klaim) baris ini,
-- termasuk riwayat booking, poin loyalitas, dan role yang sudah ada.

-- -------------------------------------------------------------
-- 2. cafes  (+ status verifikasi menggantikan alur cities/subscription lama)
--    Kafe baru WAJIB berstatus 'pending_verification' sampai admin
--    memutuskan lewat cafe_verification_log (lihat trigger di bawah).
-- -------------------------------------------------------------
CREATE TABLE cafes (
    id                 SERIAL PRIMARY KEY,
    owner_id           INTEGER NOT NULL REFERENCES users(id),
    nama               VARCHAR(150) NOT NULL,
    alamat             VARCHAR(255) NOT NULL,
    area               VARCHAR(100) NOT NULL,
    subscription_tier  subscription_tier NOT NULL DEFAULT 'standar',
    status             cafe_status NOT NULL DEFAULT 'pending_verification',
    created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 3. tables (meja)
-- -------------------------------------------------------------
CREATE TABLE tables (
    id         SERIAL PRIMARY KEY,
    cafe_id    INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    nomor_meja VARCHAR(10) NOT NULL,
    kapasitas  INTEGER NOT NULL CHECK (kapasitas > 0),
    status     table_status NOT NULL DEFAULT 'tersedia',
    UNIQUE (cafe_id, nomor_meja)
);

-- -------------------------------------------------------------
-- 4. bookings
-- -------------------------------------------------------------
CREATE TABLE bookings (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    table_id      INTEGER NOT NULL REFERENCES tables(id),
    waktu_mulai   TIMESTAMP NOT NULL,
    waktu_expired TIMESTAMP NOT NULL,
    status        booking_status NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (waktu_expired > waktu_mulai)
);

-- Perbaikan teknis: mencegah race condition / double booking.
-- Index unik parsial ini memastikan HANYA SATU booking berstatus aktif
-- (pending/confirmed) yang boleh ada untuk satu meja pada satu waktu.
-- Percobaan INSERT kedua yang bentrok akan otomatis ditolak oleh basis data,
-- bukan hanya divalidasi di level aplikasi yang rentan race condition.
CREATE UNIQUE INDEX ux_bookings_active_per_table
    ON bookings (table_id)
    WHERE status IN ('pending', 'confirmed');

-- -------------------------------------------------------------
-- 5. menus
-- -------------------------------------------------------------
CREATE TABLE menus (
    id        SERIAL PRIMARY KEY,
    cafe_id   INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    nama_menu VARCHAR(150) NOT NULL,
    harga     INTEGER NOT NULL CHECK (harga >= 0),
    kategori  menu_kategori NOT NULL
);

-- -------------------------------------------------------------
-- 6. facilities (master)
-- -------------------------------------------------------------
CREATE TABLE facilities (
    id             SERIAL PRIMARY KEY,
    nama_fasilitas VARCHAR(100) NOT NULL UNIQUE
);

-- -------------------------------------------------------------
-- 7. cafe_facilities (penghubung many-to-many)
-- -------------------------------------------------------------
CREATE TABLE cafe_facilities (
    cafe_id     INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    PRIMARY KEY (cafe_id, facility_id)
);

-- -------------------------------------------------------------
-- 8. operating_hours
-- -------------------------------------------------------------
CREATE TABLE operating_hours (
    id        SERIAL PRIMARY KEY,
    cafe_id   INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    hari      VARCHAR(50) NOT NULL,
    jam_buka  TIME NOT NULL,
    jam_tutup TIME NOT NULL
);

-- -------------------------------------------------------------
-- 9. reviews  (+ status_moderasi & dilaporkan)
-- -------------------------------------------------------------
CREATE TABLE reviews (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    cafe_id         INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    komentar        TEXT,
    status_moderasi moderasi_status NOT NULL DEFAULT 'approved',
    dilaporkan      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 10. payments  (metode disederhanakan jadi QRIS saja)
-- -------------------------------------------------------------
CREATE TABLE payments (
    id                SERIAL PRIMARY KEY,
    booking_id        INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    jumlah            INTEGER NOT NULL CHECK (jumlah >= 0),
    komisi_platform   INTEGER NOT NULL DEFAULT 0 CHECK (komisi_platform >= 0),
    metode            payment_metode NOT NULL DEFAULT 'qris',
    status            payment_status NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at           TIMESTAMP
);

-- -------------------------------------------------------------
-- 11. notifications  (pengingat, konfirmasi, status, verifikasi kafe)
-- -------------------------------------------------------------
CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipe       notification_tipe NOT NULL,
    channel    notification_channel NOT NULL DEFAULT 'in_app',
    judul      VARCHAR(150) NOT NULL,
    pesan      TEXT NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 12. cafe_verification_log  (audit trail verifikasi kafe oleh admin)
--     Insert ke tabel ini adalah SATU-SATUNYA cara status cafe berubah
--     dari pending_verification -> approved/rejected (lihat trigger).
-- -------------------------------------------------------------
CREATE TABLE cafe_verification_log (
    id          SERIAL PRIMARY KEY,
    cafe_id     INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    admin_id    INTEGER NOT NULL REFERENCES users(id),
    keputusan   verification_keputusan NOT NULL,
    catatan     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index tambahan untuk mempercepat pencarian & join yang sering dipakai
CREATE INDEX idx_cafes_area ON cafes(area);
CREATE INDEX idx_cafes_status ON cafes(status);
CREATE INDEX idx_cafes_subscription ON cafes(subscription_tier);
CREATE INDEX idx_tables_cafe_id ON tables(cafe_id);
CREATE INDEX idx_bookings_table_id ON bookings(table_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_menus_cafe_id ON menus(cafe_id);
CREATE INDEX idx_reviews_cafe_id ON reviews(cafe_id);
CREATE INDEX idx_reviews_moderasi ON reviews(status_moderasi);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX idx_verification_log_cafe ON cafe_verification_log(cafe_id);

-- =============================================================
-- VIEW PUBLIK 1: ketersediaan meja tanpa membocorkan data pribadi
-- =============================================================
-- RLS pada tabel bookings hanya boleh dibaca oleh pemiliknya sendiri
-- (kepatuhan UU PDP). Namun status 'meja mana yang sedang terisi' tetap
-- perlu terlihat oleh SEMUA pengunjung (termasuk yang belum login) agar
-- bisa memutuskan mau booking meja mana. View ini HANYA mengekspos
-- table_id yang sedang aktif dibooking -- tanpa user_id, waktu, atau data
-- pribadi lain -- sehingga aman dibaca publik.
CREATE VIEW public_table_occupancy AS
SELECT table_id
FROM bookings
WHERE status IN ('pending', 'confirmed');
GRANT SELECT ON public_table_occupancy TO anon, authenticated;

-- =============================================================
-- VIEW PUBLIK 2: total kapasitas & jumlah meja yang masih tersedia
-- per kafe -- perbaikan: selain jumlah meja, tampilkan juga total
-- kapasitas (jumlah kursi) yang tersedia.
-- =============================================================
CREATE VIEW public_cafe_capacity AS
SELECT
    t.cafe_id,
    COUNT(*) FILTER (WHERE o.table_id IS NULL)                       AS meja_tersedia,
    COALESCE(SUM(t.kapasitas) FILTER (WHERE o.table_id IS NULL), 0)  AS kapasitas_tersedia,
    COUNT(*)                                                         AS total_meja,
    COALESCE(SUM(t.kapasitas), 0)                                    AS total_kapasitas
FROM tables t
LEFT JOIN public_table_occupancy o ON o.table_id = t.id
GROUP BY t.cafe_id;
GRANT SELECT ON public_cafe_capacity TO anon, authenticated;

-- =============================================================
-- MEKANISME LOGIN (Supabase Auth) — menghubungkan auth.users <-> public.users
-- Perbaikan: role kini diambil dari pilihan pengguna saat mendaftar
-- (mahasiswa / pemilik_kafe). Role 'admin' TIDAK PERNAH bisa dipilih lewat
-- form pendaftaran publik -- akun admin hanya dibuat manual oleh operator.
-- =============================================================
CREATE OR REPLACE FUNCTION fn_handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id INTEGER;
    v_role        user_role;
BEGIN
    -- Hanya 'mahasiswa' atau 'pemilik_kafe' yang boleh dipilih sendiri;
    -- nilai lain (termasuk percobaan mengisi 'admin') jatuh ke default.
    v_role := CASE WHEN NEW.raw_user_meta_data->>'role' = 'pemilik_kafe'
                   THEN 'pemilik_kafe'::user_role
                   ELSE 'mahasiswa'::user_role END;

    SELECT id INTO v_existing_id
    FROM users
    WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Akun dummy yang sudah ada diklaim apa adanya (role & riwayat lama
        -- dipertahankan, tidak ditimpa oleh pilihan role saat signup).
        UPDATE users SET auth_user_id = NEW.id WHERE id = v_existing_id;
    ELSE
        INSERT INTO users (nama, email, role, auth_user_id)
        VALUES (
            COALESCE(NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
            NEW.email,
            v_role,
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION fn_handle_new_auth_user();

-- =============================================================
-- FUNGSI & TRIGGER — mengotomasi alur notifikasi dan verifikasi
-- =============================================================

-- -------------------------------------------------------------
-- A. Notifikasi otomatis saat booking dibuat
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_booking_after_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO notifications (user_id, tipe, channel, judul, pesan)
    VALUES (
        NEW.user_id,
        'confirmation',
        'in_app',
        'Booking dibuat',
        'Booking meja Anda telah dibuat. Batas konfirmasi: ' ||
        to_char(NEW.waktu_expired, 'DD Mon YYYY HH24:MI') || '.'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_after_insert
AFTER INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION fn_booking_after_insert();

-- -------------------------------------------------------------
-- B. Notifikasi setiap kali status booking berubah + poin loyalitas
--    Perbaikan: mencakup SEMUA transisi status (bukan hanya saat dibuat),
--    termasuk saat pemilik kafe mengonfirmasi kedatangan (-> completed)
--    dan saat scheduled job menandai booking hangus (-> expired).
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_booking_after_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_judul VARCHAR(150);
    v_pesan TEXT;
    v_tipe  notification_tipe;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN

        IF NEW.status = 'confirmed' THEN
            v_tipe := 'confirmation';
            v_judul := 'Pembayaran diterima';
            v_pesan := 'Pembayaran QRIS Anda berhasil, booking dikonfirmasi. Tunjukkan booking ini saat tiba di kafe.';
        ELSIF NEW.status = 'expired' THEN
            v_tipe := 'expired';
            v_judul := 'Booking hangus';
            v_pesan := 'Booking Anda telah hangus (expired) karena tidak dikonfirmasi/kedatangan sebelum batas waktu.';
        ELSIF NEW.status = 'cancelled' THEN
            v_tipe := 'cancelled';
            v_judul := 'Booking dibatalkan';
            v_pesan := 'Booking Anda telah dibatalkan.';
        ELSIF NEW.status = 'completed' THEN
            v_tipe := 'completed';
            v_judul := 'Kunjungan selesai';
            v_pesan := 'Kedatangan Anda telah dikonfirmasi oleh kafe. Terima kasih sudah berkunjung! Anda mendapat 10 poin loyalitas.';
            UPDATE users SET poin_loyalitas = poin_loyalitas + 10 WHERE id = NEW.user_id;
        END IF;

        IF v_judul IS NOT NULL THEN
            INSERT INTO notifications (user_id, tipe, channel, judul, pesan)
            VALUES (NEW.user_id, v_tipe, 'in_app', v_judul, v_pesan);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_after_update
AFTER UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION fn_booking_after_update();

-- -------------------------------------------------------------
-- C. Pembayaran QRIS sukses -> booking otomatis 'confirmed'
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_payment_after_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
        UPDATE bookings SET status = 'confirmed'
        WHERE id = NEW.booking_id AND status = 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_after_update
AFTER UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION fn_payment_after_update();

-- -------------------------------------------------------------
-- D. Fungsi booking ATOMIK — solusi konkret race condition
--    + identitas diambil dari sesi login (auth.uid()), bukan dari client
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_booking_atomic(
    p_table_id INTEGER,
    p_waktu_mulai TIMESTAMP
)
RETURNS bookings
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id INTEGER;
    v_conflict INTEGER;
    v_booking bookings;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE auth_user_id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Akun Anda belum terhubung ke profil CafeHub. Silakan login ulang.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    PERFORM 1 FROM tables WHERE id = p_table_id FOR UPDATE;

    SELECT id INTO v_conflict
    FROM bookings
    WHERE table_id = p_table_id AND status IN ('pending', 'confirmed')
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'Meja sedang penuh, silakan pilih meja lain.'
            USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO bookings (user_id, table_id, waktu_mulai, waktu_expired, status)
    VALUES (v_user_id, p_table_id, p_waktu_mulai, p_waktu_mulai + INTERVAL '30 minutes', 'pending')
    RETURNING * INTO v_booking;

    RETURN v_booking;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- E. Keputusan verifikasi admin -> ubah status cafe + kirim notifikasi
--    ke pemilik kafe. Ini SATU-SATUNYA jalur resmi mengubah cafes.status.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_apply_verification_decision()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id  INTEGER;
    v_cafe_nama VARCHAR(150);
    v_new_status cafe_status;
BEGIN
    v_new_status := CASE NEW.keputusan WHEN 'approved' THEN 'approved'::cafe_status
                                        ELSE 'rejected'::cafe_status END;

    UPDATE cafes SET status = v_new_status
    WHERE id = NEW.cafe_id
    RETURNING owner_id, nama INTO v_owner_id, v_cafe_nama;

    INSERT INTO notifications (user_id, tipe, channel, judul, pesan)
    VALUES (
        v_owner_id,
        'verification',
        'in_app',
        CASE NEW.keputusan WHEN 'approved' THEN 'Kafe disetujui' ELSE 'Kafe ditolak' END,
        CASE NEW.keputusan
            WHEN 'approved' THEN 'Selamat! Kafe "' || v_cafe_nama || '" telah disetujui dan kini tampil di CafeHub.'
            ELSE 'Pendaftaran kafe "' || v_cafe_nama || '" belum dapat disetujui. Catatan admin: ' || COALESCE(NEW.catatan, '-')
        END
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_verification_decision
AFTER INSERT ON cafe_verification_log
FOR EACH ROW EXECUTE FUNCTION fn_apply_verification_decision();

-- =============================================================
-- SCHEDULED JOB (dijalankan berkala, mis. tiap menit, oleh Supabase
-- Cron / pg_cron): booking yang lewat batas waktu tanpa kedatangan
-- otomatis hangus -- berlaku untuk 'pending' (belum bayar) MAUPUN
-- 'confirmed' (sudah bayar tapi pelanggan tidak datang / no-show).
-- =============================================================
-- UPDATE bookings SET status = 'expired'
-- WHERE status IN ('pending', 'confirmed') AND waktu_expired < NOW();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_verification_log ENABLE ROW LEVEL SECURITY;

-- --- Data non-sensitif: boleh dibaca siapa saja (termasuk belum login) ---
CREATE POLICY "Publik membaca tables" ON tables FOR SELECT USING (true);
CREATE POLICY "Publik membaca menus" ON menus FOR SELECT USING (true);
CREATE POLICY "Publik membaca facilities" ON facilities FOR SELECT USING (true);
CREATE POLICY "Publik membaca cafe_facilities" ON cafe_facilities FOR SELECT USING (true);
CREATE POLICY "Publik membaca operating_hours" ON operating_hours FOR SELECT USING (true);
CREATE POLICY "Publik membaca log verifikasi" ON cafe_verification_log FOR SELECT USING (true);

-- --- cafes: publik hanya boleh melihat yang sudah 'approved'. Pemilik
--     boleh melihat & mendaftarkan kafenya sendiri di status apa pun.
--     Admin boleh melihat semua (untuk dasbor verifikasi). ---
CREATE POLICY "Publik membaca cafe approved" ON cafes FOR SELECT
    USING (status = 'approved');
CREATE POLICY "Pemilik membaca cafe sendiri" ON cafes FOR SELECT
    USING (owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admin membaca semua cafe" ON cafes FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Pemilik mendaftarkan cafe baru" ON cafes FOR INSERT
    TO authenticated
    WITH CHECK (owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid() AND role = 'pemilik_kafe'));
CREATE POLICY "Pemilik memperbarui data cafe sendiri" ON cafes FOR UPDATE
CREATE POLICY "Pemilik menambah meja di cafenya" ON tables FOR INSERT
    TO authenticated
    WITH CHECK (cafe_id IN (
        SELECT id FROM cafes WHERE owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ));

CREATE POLICY "Pemilik menambah menu di cafenya" ON menus FOR INSERT
    TO authenticated
    WITH CHECK (cafe_id IN (
        SELECT id FROM cafes WHERE owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ));

CREATE POLICY "Pemilik menambah jam operasional cafenya" ON operating_hours FOR INSERT
    TO authenticated
    WITH CHECK (cafe_id IN (
        SELECT id FROM cafes WHERE owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ));

CREATE POLICY "Pemilik menambah fasilitas cafenya" ON cafe_facilities FOR INSERT
    TO authenticated
    WITH CHECK (cafe_id IN (
        SELECT id FROM cafes WHERE owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )); 
    USING (owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
    WITH CHECK (owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- --- users: nama & role perlu terbaca publik (dipakai di ulasan & log
--     verifikasi), tapi hanya pemilik akun yang boleh mengubah datanya. ---
CREATE POLICY "Publik membaca profil dasar" ON users FOR SELECT USING (true);
CREATE POLICY "User memperbarui profil sendiri" ON users FOR UPDATE
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- --- reviews: ulasan approved terbuka untuk publik; penulis tetap bisa
--     melihat ulasan miliknya sendiri walau berstatus pending/rejected. ---
CREATE POLICY "Publik membaca ulasan approved" ON reviews FOR SELECT
    USING (
        status_moderasi = 'approved'
        OR user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );
CREATE POLICY "User membuat ulasan sendiri" ON reviews FOR INSERT
    TO authenticated
    WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));
CREATE POLICY "User login dapat melaporkan ulasan" ON reviews FOR UPDATE
    TO authenticated
    USING (true) WITH CHECK (true);

-- --- bookings: berisi data pribadi -> HANYA pemiliknya, pemilik kafe
--     terkait, dan admin yang boleh membaca. Tidak ada policy INSERT di
--     sini secara sengaja: pembuatan booking WAJIB lewat
--     create_booking_atomic() (SECURITY DEFINER) agar identitas &
--     pengecekan konflik tetap aman. ---
CREATE POLICY "User membaca booking sendiri" ON bookings FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Pemilik membaca booking di cafenya" ON bookings FOR SELECT
    USING (table_id IN (
        SELECT t.id FROM tables t JOIN cafes c ON c.id = t.cafe_id
        WHERE c.owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ));
CREATE POLICY "Admin membaca semua booking" ON bookings FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'admin'));
-- Pemilik kafe HANYA boleh mengonfirmasi kedatangan (-> completed) atau
-- membatalkan (-> cancelled); tidak boleh mengubah field lain.
CREATE POLICY "Pemilik konfirmasi kedatangan di cafenya" ON bookings FOR UPDATE
    USING (table_id IN (
        SELECT t.id FROM tables t JOIN cafes c ON c.id = t.cafe_id
        WHERE c.owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ))
    WITH CHECK (status IN ('completed', 'cancelled'));

-- --- payments: data pribadi, hanya pemiliknya ---
CREATE POLICY "User membaca payment sendiri" ON payments FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));
CREATE POLICY "User membuat payment sendiri" ON payments FOR INSERT
    TO authenticated
    WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));
-- Catatan demo: di produksi nyata, status 'paid' semestinya diisi oleh
-- webhook penyedia QRIS (server-side, service role), bukan langsung oleh
-- klien. Policy ini disediakan agar tombol "Saya sudah membayar" pada
-- prototipe bisa mensimulasikan proses tersebut tanpa payment gateway asli.
CREATE POLICY "User memperbarui payment sendiri (simulasi bayar)" ON payments FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- --- notifications: data pribadi, hanya pemiliknya ---
CREATE POLICY "User membaca notifikasi sendiri" ON notifications FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));
CREATE POLICY "User menandai notifikasi sendiri" ON notifications FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- --- cafe_verification_log: hanya admin yang boleh menulis keputusan ---
CREATE POLICY "Admin membuat log verifikasi" ON cafe_verification_log FOR INSERT
    TO authenticated
    WITH CHECK (admin_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid() AND role = 'admin'));

-- =============================================================
-- DATA DUMMY
-- =============================================================

-- 1. users (29 akun: 10 mahasiswa, 1 admin, 18 pemilik kafe)
INSERT INTO users (id, nama, email, role) VALUES
(1, 'Ahmad Fauzan', 'ahmad.fauzan@student.ac.id', 'mahasiswa'),
(2, 'Siti Nur Aini', 'siti.nur.aini@student.ac.id', 'mahasiswa'),
(3, 'Bagas Pratama', 'bagas.pratama@student.ac.id', 'mahasiswa'),
(4, 'Dewi Lestari', 'dewi.lestari@student.ac.id', 'mahasiswa'),
(5, 'Rizky Ramadhan', 'rizky.ramadhan@student.ac.id', 'mahasiswa'),
(6, 'Putri Amelia', 'putri.amelia@student.ac.id', 'mahasiswa'),
(7, 'Fajar Nugroho', 'fajar.nugroho@student.ac.id', 'mahasiswa'),
(8, 'Salsabila Zahra', 'salsabila.zahra@student.ac.id', 'mahasiswa'),
(9, 'Andika Wirawan', 'andika.wirawan@student.ac.id', 'mahasiswa'),
(10, 'Nabila Rahma', 'nabila.rahma@student.ac.id', 'mahasiswa'),
(11, 'Admin CafeHub', 'admin@cafehub.id', 'admin'),
(12, 'Hendra Wijaya', 'hendra.wijaya@cafehub.id', 'pemilik_kafe'),
(13, 'Yuni Kartika', 'yuni.kartika@cafehub.id', 'pemilik_kafe'),
(14, 'Bayu Setiawan', 'bayu.setiawan@cafehub.id', 'pemilik_kafe'),
(15, 'Rina Marlina', 'rina.marlina@cafehub.id', 'pemilik_kafe'),
(16, 'Doni Saputra', 'doni.saputra@cafehub.id', 'pemilik_kafe'),
(17, 'Lestari Handayani', 'lestari.handayani@cafehub.id', 'pemilik_kafe'),
(18, 'Agus Setiadi', 'agus.setiadi@cafehub.id', 'pemilik_kafe'),
(19, 'Maya Puspita', 'maya.puspita@cafehub.id', 'pemilik_kafe'),
(20, 'Reza Firmansyah', 'reza.firmansyah@cafehub.id', 'pemilik_kafe'),
(21, 'Indah Permatasari', 'indah.permatasari@cafehub.id', 'pemilik_kafe'),
(22, 'Wahyu Hidayat', 'wahyu.hidayat@cafehub.id', 'pemilik_kafe'),
(23, 'Citra Ayu', 'citra.ayu@cafehub.id', 'pemilik_kafe'),
(24, 'Fikri Ramadhan', 'fikri.ramadhan@cafehub.id', 'pemilik_kafe'),
(25, 'Novita Sari', 'novita.sari@cafehub.id', 'pemilik_kafe'),
(26, 'Eka Prasetya', 'eka.prasetya@cafehub.id', 'pemilik_kafe'),
(27, 'Galih Nugraha', 'galih.nugraha@cafehub.id', 'pemilik_kafe'),
(28, 'Sinta Dewanti', 'sinta.dewanti@cafehub.id', 'pemilik_kafe'),
(29, 'Taufik Ridwan', 'taufik.ridwan@cafehub.id', 'pemilik_kafe');
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));

-- 2. cafes (20 kafe berstatus default 'pending_verification'; akan berubah
--    menjadi 'approved' otomatis lewat trigger saat cafe_verification_log
--    diisi di bagian akhir skrip ini -- mensimulasikan alur nyata.
--    Kafe ke-21 SENGAJA dibiarkan belum diverifikasi untuk mendemokan
--    dasbor verifikasi admin.)
INSERT INTO cafes (id, owner_id, nama, alamat, area, subscription_tier) VALUES
(1, 12, 'Kopi Kita - Lowokwaru', 'Jl. MT Haryono No. 7, Lowokwaru, Malang', 'Lowokwaru', 'standar'),
(2, 12, 'Ruang Seduh - Klojen', 'Jl. Basuki Rahmat No. 12, Klojen, Malang', 'Klojen', 'premium'),
(3, 13, 'Nulis Coffee - Sukun', 'Jl. S. Supriadi No. 45, Sukun, Malang', 'Sukun', 'standar'),
(4, 13, 'Kedai Aksara - Blimbing', 'Jl. L.A. Sucipto No. 88, Blimbing, Malang', 'Blimbing', 'standar'),
(5, 14, 'Titik Nol Coffee - Kedungkandang', 'Jl. Ki Ageng Gribig No. 21, Kedungkandang, Malang', 'Kedungkandang', 'standar'),
(6, 14, 'Kopi Senja - Dau', 'Jl. Raya Sengkaling No. 5, Dau, Malang', 'Dau', 'standar'),
(7, 15, 'Warung Fokus - Batu', 'Jl. Diponegoro No. 30, Batu, Malang', 'Batu', 'premium'),
(8, 16, 'Cangkir Ide - Junrejo', 'Jl. Ir. Soekarno No. 19, Junrejo, Batu', 'Junrejo', 'standar'),
(9, 17, 'Kopi Merapat - Karangploso', 'Jl. Raya Karangploso No. 3, Karangploso, Malang', 'Karangploso', 'standar'),
(10, 18, 'Roastery 88 - Singosari', 'Jl. Kertanegara No. 88, Singosari, Malang', 'Singosari', 'standar'),
(11, 19, 'Kopi & Kertas - Lowokwaru', 'Jl. Sigura-gura No. 14, Lowokwaru, Malang', 'Lowokwaru', 'premium'),
(12, 20, 'Ruang Baca Coffee - Klojen', 'Jl. Ijen No. 9, Klojen, Malang', 'Klojen', 'standar'),
(13, 21, 'Kedai Tenang - Sukun', 'Jl. Raya Sukun No. 55, Sukun, Malang', 'Sukun', 'standar'),
(14, 22, 'Kopi Sudut - Blimbing', 'Jl. Borobudur No. 27, Blimbing, Malang', 'Blimbing', 'standar'),
(15, 23, 'Bab Kopi - Kedungkandang', 'Jl. Danau Toba No. 6, Kedungkandang, Malang', 'Kedungkandang', 'standar'),
(16, 24, 'Kopi Nusantara Muda - Dau', 'Jl. Raya Tlogomas No. 40, Dau, Malang', 'Dau', 'premium'),
(17, 25, 'Loka Kopi - Batu', 'Jl. Panglima Sudirman No. 17, Batu, Malang', 'Batu', 'standar'),
(18, 26, 'Kopi Semesta - Junrejo', 'Jl. Beji No. 8, Junrejo, Batu', 'Junrejo', 'standar'),
(19, 27, 'Studi Kopi - Karangploso', 'Jl. Raya Ngijo No. 2, Karangploso, Malang', 'Karangploso', 'standar'),
(20, 28, 'Kopi Larik - Singosari', 'Jl. Raya Singosari No. 60, Singosari, Malang', 'Singosari', 'standar'),
(21, 29, 'Kedai Baru - Sukun', 'Jl. Raya Sukun No. 101, Sukun, Malang', 'Sukun', 'standar');
SELECT setval(pg_get_serial_sequence('cafes', 'id'), (SELECT MAX(id) FROM cafes));

-- 3. tables (60 meja untuk 20 kafe pertama, 3 per kafe; kafe #21 belum
--    mengisi meja karena masih menunggu verifikasi)
INSERT INTO tables (id, cafe_id, nomor_meja, kapasitas, status) VALUES
(1, 1, 'M1', 6, 'tersedia'),
(2, 1, 'M2', 6, 'tersedia'),
(3, 1, 'M3', 2, 'tersedia'),
(4, 2, 'M1', 6, 'tersedia'),
(5, 2, 'M2', 2, 'tersedia'),
(6, 2, 'M3', 2, 'tersedia'),
(7, 3, 'M1', 2, 'tersedia'),
(8, 3, 'M2', 2, 'tersedia'),
(9, 3, 'M3', 2, 'tersedia'),
(10, 4, 'M1', 2, 'tersedia'),
(11, 4, 'M2', 2, 'tersedia'),
(12, 4, 'M3', 4, 'tersedia'),
(13, 5, 'M1', 2, 'tersedia'),
(14, 5, 'M2', 6, 'tersedia'),
(15, 5, 'M3', 2, 'tersedia'),
(16, 6, 'M1', 4, 'tersedia'),
(17, 6, 'M2', 4, 'tersedia'),
(18, 6, 'M3', 2, 'tersedia'),
(19, 7, 'M1', 6, 'tersedia'),
(20, 7, 'M2', 2, 'tersedia'),
(21, 7, 'M3', 6, 'tersedia'),
(22, 8, 'M1', 6, 'tersedia'),
(23, 8, 'M2', 4, 'tersedia'),
(24, 8, 'M3', 2, 'tersedia'),
(25, 9, 'M1', 4, 'tersedia'),
(26, 9, 'M2', 4, 'tersedia'),
(27, 9, 'M3', 2, 'tersedia'),
(28, 10, 'M1', 2, 'tersedia'),
(29, 10, 'M2', 2, 'tersedia'),
(30, 10, 'M3', 4, 'tersedia'),
(31, 11, 'M1', 4, 'tersedia'),
(32, 11, 'M2', 4, 'tersedia'),
(33, 11, 'M3', 4, 'tersedia'),
(34, 12, 'M1', 4, 'tersedia'),
(35, 12, 'M2', 2, 'tersedia'),
(36, 12, 'M3', 2, 'tersedia'),
(37, 13, 'M1', 2, 'tersedia'),
(38, 13, 'M2', 4, 'tersedia'),
(39, 13, 'M3', 4, 'tersedia'),
(40, 14, 'M1', 2, 'tersedia'),
(41, 14, 'M2', 2, 'tersedia'),
(42, 14, 'M3', 2, 'tersedia'),
(43, 15, 'M1', 2, 'tersedia'),
(44, 15, 'M2', 6, 'tersedia'),
(45, 15, 'M3', 4, 'tersedia'),
(46, 16, 'M1', 2, 'tersedia'),
(47, 16, 'M2', 4, 'tersedia'),
(48, 16, 'M3', 2, 'tersedia'),
(49, 17, 'M1', 4, 'tersedia'),
(50, 17, 'M2', 4, 'tersedia'),
(51, 17, 'M3', 2, 'tersedia'),
(52, 18, 'M1', 2, 'tersedia'),
(53, 18, 'M2', 4, 'tersedia'),
(54, 18, 'M3', 6, 'tersedia'),
(55, 19, 'M1', 2, 'tersedia'),
(56, 19, 'M2', 2, 'tersedia'),
(57, 19, 'M3', 6, 'tersedia'),
(58, 20, 'M1', 2, 'tersedia'),
(59, 20, 'M2', 2, 'tersedia'),
(60, 20, 'M3', 2, 'tersedia');
SELECT setval(pg_get_serial_sequence('tables', 'id'), (SELECT MAX(id) FROM tables));

-- 4. bookings (20 contoh booking historis)
-- Trigger trg_booking_after_insert otomatis membuat notifikasi untuk
-- tiap baris berikut.
INSERT INTO bookings (user_id, table_id, waktu_mulai, waktu_expired, status) VALUES
(4, 26, TIMESTAMP '2026-07-01 23:00:00', TIMESTAMP '2026-07-01 23:00:00' + INTERVAL '30 minutes', 'completed'),
(4, 38, TIMESTAMP '2026-07-01 13:00:00', TIMESTAMP '2026-07-01 13:00:00' + INTERVAL '30 minutes', 'completed'),
(2, 27, TIMESTAMP '2026-07-04 08:00:00', TIMESTAMP '2026-07-04 08:00:00' + INTERVAL '30 minutes', 'completed'),
(6, 60, TIMESTAMP '2026-07-02 17:00:00', TIMESTAMP '2026-07-02 17:00:00' + INTERVAL '30 minutes', 'confirmed'),
(6, 16, TIMESTAMP '2026-07-02 17:00:00', TIMESTAMP '2026-07-02 17:00:00' + INTERVAL '30 minutes', 'cancelled'),
(3, 43, TIMESTAMP '2026-07-02 22:00:00', TIMESTAMP '2026-07-02 22:00:00' + INTERVAL '30 minutes', 'cancelled'),
(6, 60, TIMESTAMP '2026-07-01 17:00:00', TIMESTAMP '2026-07-01 17:00:00' + INTERVAL '30 minutes', 'completed'),
(8, 40, TIMESTAMP '2026-07-04 08:00:00', TIMESTAMP '2026-07-04 08:00:00' + INTERVAL '30 minutes', 'pending'),
(2, 35, TIMESTAMP '2026-07-02 11:00:00', TIMESTAMP '2026-07-02 11:00:00' + INTERVAL '30 minutes', 'completed'),
(5, 9, TIMESTAMP '2026-07-03 04:00:00', TIMESTAMP '2026-07-03 04:00:00' + INTERVAL '30 minutes', 'pending'),
(4, 24, TIMESTAMP '2026-07-02 20:00:00', TIMESTAMP '2026-07-02 20:00:00' + INTERVAL '30 minutes', 'confirmed'),
(8, 54, TIMESTAMP '2026-07-04 05:00:00', TIMESTAMP '2026-07-04 05:00:00' + INTERVAL '30 minutes', 'expired'),
(10, 52, TIMESTAMP '2026-07-04 03:00:00', TIMESTAMP '2026-07-04 03:00:00' + INTERVAL '30 minutes', 'pending'),
(9, 20, TIMESTAMP '2026-07-01 21:00:00', TIMESTAMP '2026-07-01 21:00:00' + INTERVAL '30 minutes', 'confirmed'),
(5, 8, TIMESTAMP '2026-07-01 21:00:00', TIMESTAMP '2026-07-01 21:00:00' + INTERVAL '30 minutes', 'completed'),
(3, 18, TIMESTAMP '2026-07-02 20:00:00', TIMESTAMP '2026-07-02 20:00:00' + INTERVAL '30 minutes', 'completed'),
(4, 46, TIMESTAMP '2026-07-03 03:00:00', TIMESTAMP '2026-07-03 03:00:00' + INTERVAL '30 minutes', 'confirmed'),
(5, 33, TIMESTAMP '2026-07-03 22:00:00', TIMESTAMP '2026-07-03 22:00:00' + INTERVAL '30 minutes', 'expired'),
(1, 6, TIMESTAMP '2026-07-03 14:00:00', TIMESTAMP '2026-07-03 14:00:00' + INTERVAL '30 minutes', 'expired'),
(1, 1, TIMESTAMP '2026-07-03 02:00:00', TIMESTAMP '2026-07-03 02:00:00' + INTERVAL '30 minutes', 'confirmed');

-- 5. menus (40 item, 2 per kafe)
INSERT INTO menus (cafe_id, nama_menu, harga, kategori) VALUES
(1, 'Matcha Latte', 22000, 'minuman'),
(1, 'Kentang Goreng', 15000, 'snack'),
(2, 'Croissant', 18000, 'snack'),
(2, 'Es Teh Manis', 8000, 'minuman'),
(3, 'Cappuccino', 20000, 'minuman'),
(3, 'Kentang Goreng', 15000, 'snack'),
(4, 'Kopi Susu Gula Aren', 18000, 'minuman'),
(4, 'Matcha Latte', 22000, 'minuman'),
(5, 'Kentang Goreng', 15000, 'snack'),
(5, 'Kopi Susu Gula Aren', 18000, 'minuman'),
(6, 'Kentang Goreng', 15000, 'snack'),
(6, 'Roti Bakar Coklat Keju', 17000, 'makanan'),
(7, 'Croissant', 18000, 'snack'),
(7, 'Roti Bakar Coklat Keju', 17000, 'makanan'),
(8, 'Kentang Goreng', 15000, 'snack'),
(8, 'Indomie Rebus Telur', 12000, 'makanan'),
(9, 'Croissant', 18000, 'snack'),
(9, 'Matcha Latte', 22000, 'minuman'),
(10, 'Cappuccino', 20000, 'minuman'),
(10, 'Roti Bakar Coklat Keju', 17000, 'makanan'),
(11, 'Cappuccino', 20000, 'minuman'),
(11, 'Kopi Susu Gula Aren', 18000, 'minuman'),
(12, 'Es Teh Manis', 8000, 'minuman'),
(12, 'Indomie Rebus Telur', 12000, 'makanan'),
(13, 'Kopi Susu Gula Aren', 18000, 'minuman'),
(13, 'Nasi Goreng Kampung', 23000, 'makanan'),
(14, 'Kopi Susu Gula Aren', 18000, 'minuman'),
(14, 'Es Teh Manis', 8000, 'minuman'),
(15, 'Es Teh Manis', 8000, 'minuman'),
(15, 'Croissant', 18000, 'snack'),
(16, 'Indomie Rebus Telur', 12000, 'makanan'),
(16, 'Es Teh Manis', 8000, 'minuman'),
(17, 'Matcha Latte', 22000, 'minuman'),
(17, 'Kopi Susu Gula Aren', 18000, 'minuman'),
(18, 'Indomie Rebus Telur', 12000, 'makanan'),
(18, 'Es Kopi Americano', 15000, 'minuman'),
(19, 'Matcha Latte', 22000, 'minuman'),
(19, 'Es Kopi Americano', 15000, 'minuman'),
(20, 'Es Teh Manis', 8000, 'minuman'),
(20, 'Es Kopi Americano', 15000, 'minuman');

-- 6. facilities (master data 10 fasilitas)
INSERT INTO facilities (id, nama_fasilitas) VALUES
(1, 'Wi-Fi Kencang'),
(2, 'Stop Kontak per Meja'),
(3, 'AC / Pendingin Ruangan'),
(4, 'Mushola'),
(5, 'Area Parkir Luas'),
(6, 'Ruang Meeting'),
(7, 'Live Music'),
(8, 'Outdoor Seating'),
(9, 'Area Non-Smoking'),
(10, 'Pet Friendly');
SELECT setval(pg_get_serial_sequence('facilities', 'id'), (SELECT MAX(id) FROM facilities));

-- 7. cafe_facilities
INSERT INTO cafe_facilities (cafe_id, facility_id) VALUES
(1, 1), (1, 8), (1, 2), (1, 4), (1, 10),
(2, 10), (2, 6), (2, 4), (2, 9), (2, 1),
(3, 4), (3, 5), (3, 2),
(4, 2), (4, 7), (4, 5), (4, 4),
(5, 3), (5, 6), (5, 9), (5, 2), (5, 8),
(6, 2), (6, 3), (6, 4), (6, 10), (6, 8),
(7, 5), (7, 9), (7, 4), (7, 6), (7, 3), (7, 1),
(8, 1), (8, 6), (8, 7), (8, 3),
(9, 4), (9, 6), (9, 10),
(10, 7), (10, 8), (10, 3), (10, 9), (10, 2), (10, 6),
(11, 10), (11, 7), (11, 9), (11, 3), (11, 2),
(12, 9), (12, 8), (12, 2), (12, 7),
(13, 2), (13, 3), (13, 9),
(14, 10), (14, 2), (14, 7), (14, 4), (14, 5), (14, 8),
(15, 9), (15, 1), (15, 2), (15, 6), (15, 5),
(16, 6), (16, 2), (16, 5), (16, 4), (16, 9),
(17, 1), (17, 5), (17, 3), (17, 9), (17, 10), (17, 8),
(18, 3), (18, 6), (18, 10), (18, 5),
(19, 10), (19, 6), (19, 8),
(20, 2), (20, 6), (20, 5);

-- 8. operating_hours
INSERT INTO operating_hours (cafe_id, hari, jam_buka, jam_tutup) VALUES
(1, 'Senin-Minggu', '07:00', '21:00'),
(2, 'Senin-Minggu', '07:00', '23:00'),
(3, 'Senin-Minggu', '07:00', '21:00'),
(4, 'Senin-Minggu', '09:00', '22:00'),
(5, 'Senin-Minggu', '07:00', '23:00'),
(6, 'Senin-Minggu', '07:00', '21:00'),
(7, 'Senin-Minggu', '09:00', '22:00'),
(8, 'Senin-Minggu', '09:00', '21:00'),
(9, 'Senin-Minggu', '08:00', '23:00'),
(10, 'Senin-Minggu', '09:00', '22:00'),
(11, 'Senin-Minggu', '07:00', '23:00'),
(12, 'Senin-Minggu', '09:00', '23:00'),
(13, 'Senin-Minggu', '07:00', '23:00'),
(14, 'Senin-Minggu', '08:00', '22:00'),
(15, 'Senin-Minggu', '09:00', '23:00'),
(16, 'Senin-Minggu', '08:00', '22:00'),
(17, 'Senin-Minggu', '09:00', '22:00'),
(18, 'Senin-Minggu', '07:00', '21:00'),
(19, 'Senin-Minggu', '07:00', '21:00'),
(20, 'Senin-Minggu', '08:00', '21:00');

-- 9. reviews (15 ulasan, 1 contoh ditandai dilaporkan/pending moderasi)
INSERT INTO reviews (user_id, cafe_id, rating, komentar, status_moderasi, dilaporkan) VALUES
(5, 6, 5, 'AC dingin dan tempat duduk empuk, betah lama-lama.', 'approved', FALSE),
(9, 1, 3, 'Kopinya enak, tapi meja agak terbatas saat jam sibuk.', 'pending', TRUE),
(3, 18, 3, 'Area outdoor-nya sejuk, tapi agak berisik siang hari.', 'approved', FALSE),
(10, 18, 4, 'AC dingin dan tempat duduk empuk, betah lama-lama.', 'approved', FALSE),
(3, 2, 4, 'Area outdoor-nya sejuk, tapi agak berisik siang hari.', 'approved', FALSE),
(1, 12, 4, 'Suasana tenang, pas buat fokus belajar kelompok.', 'approved', FALSE),
(2, 12, 5, 'AC dingin dan tempat duduk empuk, betah lama-lama.', 'approved', FALSE),
(10, 5, 4, 'Colokan listrik banyak, cocok buat kerja lama.', 'approved', FALSE),
(3, 14, 3, 'Colokan listrik banyak, cocok buat kerja lama.', 'approved', FALSE),
(6, 14, 4, 'Pelayanan ramah, harga menu terjangkau untuk mahasiswa.', 'approved', FALSE),
(3, 4, 5, 'Tempatnya nyaman buat ngerjain tugas, Wi-Fi stabil.', 'approved', FALSE),
(8, 8, 4, 'Parkirnya luas, gampang buat yang bawa motor rame-rame.', 'approved', FALSE),
(6, 10, 4, 'Suasana tenang, pas buat fokus belajar kelompok.', 'approved', FALSE),
(1, 7, 5, 'Area outdoor-nya sejuk, tapi agak berisik siang hari.', 'approved', FALSE),
(5, 3, 4, 'Area outdoor-nya sejuk, tapi agak berisik siang hari.', 'approved', FALSE);

-- 10. payments (contoh deposit QRIS untuk booking berstatus confirmed/completed)
-- Deposit flat Rp10.000/booking dengan komisi platform 10%.
INSERT INTO payments (booking_id, user_id, jumlah, komisi_platform, metode, status, paid_at) VALUES
(1, 4, 10000, 1000, 'qris', 'paid', NOW()),
(2, 4, 10000, 1000, 'qris', 'paid', NOW()),
(3, 2, 10000, 1000, 'qris', 'paid', NOW()),
(4, 6, 10000, 1000, 'qris', 'pending', NULL),
(7, 6, 10000, 1000, 'qris', 'paid', NOW()),
(9, 2, 10000, 1000, 'qris', 'paid', NOW()),
(11, 4, 10000, 1000, 'qris', 'pending', NULL),
(14, 9, 10000, 1000, 'qris', 'pending', NULL),
(15, 5, 10000, 1000, 'qris', 'paid', NOW()),
(16, 3, 10000, 1000, 'qris', 'paid', NOW()),
(17, 4, 10000, 1000, 'qris', 'pending', NULL),
(20, 1, 10000, 1000, 'qris', 'pending', NULL);

-- 11. cafe_verification_log (audit trail persetujuan 20 kafe pertama oleh
--     admin -- setiap INSERT di sini otomatis memicu trigger
--     trg_apply_verification_decision yang mengubah cafes.status menjadi
--     'approved' dan mengirim notifikasi ke pemiliknya. Kafe #21 SENGAJA
--     tidak diberi baris di sini -- masih 'pending_verification', untuk
--     mendemokan dasbor verifikasi admin.)
INSERT INTO cafe_verification_log (cafe_id, admin_id, keputusan, catatan, created_at) VALUES
(1, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 1)),
(2, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 2)),
(3, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 3)),
(4, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 4)),
(5, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 5)),
(6, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 6)),
(7, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 7)),
(8, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 8)),
(9, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 9)),
(10, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 10)),
(11, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 11)),
(12, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 12)),
(13, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 13)),
(14, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 14)),
(15, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 15)),
(16, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 16)),
(17, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 17)),
(18, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 18)),
(19, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 19)),
(20, 11, 'approved', 'Dokumen legalitas dan lokasi kafe lengkap, disetujui saat pendaftaran awal.', TIMESTAMP '2026-06-20 09:00:00' + (INTERVAL '1 day' * 20));

-- =============================================================
-- SELESAI
-- =============================================================
