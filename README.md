# CafeHub v3

Aplikasi reservasi meja kafe (Next.js 14 App Router + Supabase + Tailwind),
hasil rebuild dari CafeHub v2 berdasarkan dokumen perbaikan.

## Perubahan utama dari v2

- Login/registrasi dengan pilihan peran: **pengunjung (mahasiswa)** atau
  **pemilik kafe**. Akun admin hanya dibuat manual (tidak lewat form publik).
- Alur pendaftaran & verifikasi kafe: pemilik mengisi detail kafe (meja,
  menu, jam operasional, fasilitas) → status `pending_verification` →
  admin menyetujui/menolak di `/admin` → kafe baru tampil publik.
- Pemilik kafe mengonfirmasi kedatangan pelanggan (booking → `completed`)
  dari `/owner/bookings`. Booking yang tidak dikonfirmasi sampai batas
  waktu otomatis `expired` lewat scheduled job.
- Notifikasi dikirim otomatis di setiap perubahan status booking, hasil
  pembayaran, dan hasil verifikasi kafe (lihat `/notifications`).
- Pembayaran disederhanakan menjadi satu metode: **QRIS** (simulasi, tanpa
  payment gateway sungguhan).
- Info ketersediaan kini menampilkan jumlah meja **dan** total kapasitas
  kursi yang tersisa per kafe.
- Tabel `cities` dan `waitlist` dihapus untuk menyederhanakan cakupan.

## Struktur proyek

```
app/                  Halaman (App Router)
  cafes/[id]/         Detail kafe + form booking
  booking/[id]/payment/  Pembayaran QRIS
  owner/              Dasbor pemilik kafe, daftar kafe, kelola booking
  admin/              Verifikasi kafe & moderasi ulasan
components/           Komponen UI reusable
lib/supabase/         Klien Supabase (browser, server, middleware)
lib/types.ts          Tipe data sesuai schema_v3.sql
supabase/schema_v3.sql  Skema database lengkap + data dummy
```

## Menjalankan secara lokal

1. Buat project di [supabase.com](https://supabase.com), lalu jalankan isi
   `supabase/schema_v3.sql` di **SQL Editor** project tersebut.
2. Salin `.env.local.example` menjadi `.env.local`, isi dengan URL dan anon
   key project Supabase Anda (Project Settings → API).
3. Install dependency & jalankan:

   ```bash
   npm install
   npm run dev
   ```

4. Buka `http://localhost:3000`.

## Akun demo

Data dummy di `schema_v3.sql` membuat baris di tabel `users` tanpa akun
login (`auth_user_id` masih kosong). Untuk mencobanya, daftar lewat `/register`
menggunakan salah satu email dummy tersebut (mis. `admin@cafehub.id` untuk
peran admin) — sistem otomatis "mengklaim" data & riwayat lama itu ke akun
baru Anda berdasarkan kecocokan email.

## Deploy ke Vercel

1. Push folder ini ke repository GitHub.
2. Import repo di [vercel.com](https://vercel.com) → New Project.
3. Tambahkan environment variables yang sama seperti `.env.local` di
   pengaturan project Vercel.
4. Deploy.
