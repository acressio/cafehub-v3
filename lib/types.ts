// Tipe-tipe ini merefleksikan enum & tabel pada schema_v3.sql.
// (Untuk type-safety penuh dari Supabase, generate ulang dengan:
//  npx supabase gen types typescript --project-id <id> > lib/database.types.ts
//  lalu ganti `Database = any` di bawah dengan hasilnya.)

export type UserRole = "mahasiswa" | "pemilik_kafe" | "admin";
export type CafeStatus = "pending_verification" | "approved" | "rejected";
export type TableStatus = "tersedia" | "terisi";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "expired"
  | "cancelled"
  | "completed";
export type MenuKategori = "makanan" | "minuman" | "snack";
export type SubscriptionTier = "standar" | "premium";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type NotificationTipe =
  | "confirmation"
  | "reminder"
  | "expired"
  | "cancelled"
  | "completed"
  | "payment"
  | "verification";
export type VerificationKeputusan = "approved" | "rejected";

export interface AppUser {
  id: number;
  auth_user_id: string | null;
  nama: string;
  email: string;
  role: UserRole;
  poin_loyalitas: number;
  created_at: string;
}

export interface Cafe {
  id: number;
  owner_id: number;
  nama: string;
  alamat: string;
  area: string;
  subscription_tier: SubscriptionTier;
  status: CafeStatus;
  created_at: string;
}

export interface CafeTable {
  id: number;
  cafe_id: number;
  nomor_meja: string;
  kapasitas: number;
  status: TableStatus;
}

export interface Booking {
  id: number;
  user_id: number;
  table_id: number;
  waktu_mulai: string;
  waktu_expired: string;
  status: BookingStatus;
  created_at: string;
}

export interface Menu {
  id: number;
  cafe_id: number;
  nama_menu: string;
  harga: number;
  kategori: MenuKategori;
}

export interface Facility {
  id: number;
  nama_fasilitas: string;
}

export interface OperatingHour {
  id: number;
  cafe_id: number;
  hari: string;
  jam_buka: string;
  jam_tutup: string;
}

export interface Review {
  id: number;
  user_id: number;
  cafe_id: number;
  rating: number;
  komentar: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  booking_id: number;
  user_id: number;
  jumlah: number;
  komisi_platform: number;
  metode: "qris";
  status: PaymentStatus;
  created_at: string;
  paid_at: string | null;
}

export interface Notification {
  id: number;
  user_id: number;
  tipe: NotificationTipe;
  judul: string;
  pesan: string;
  is_read: boolean;
  created_at: string;
}

export interface CafeVerificationLog {
  id: number;
  cafe_id: number;
  admin_id: number;
  keputusan: VerificationKeputusan;
  catatan: string | null;
  created_at: string;
}

export interface CafeCapacity {
  cafe_id: number;
  meja_tersedia: number;
  kapasitas_tersedia: number;
  total_meja: number;
  total_kapasitas: number;
}

// Placeholder loose type supaya @supabase/ssr generic <Database> tetap
// bisa dipakai sebelum tipe hasil `supabase gen types` di-generate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
