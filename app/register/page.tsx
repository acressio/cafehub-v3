"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { GraduationCap, Store } from "lucide-react";

type Role = "mahasiswa" | "pemilik_kafe";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const [role, setRole] = useState<Role>("mahasiswa");
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nama, role } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Jika project Supabase mewajibkan konfirmasi email, session belum aktif.
    if (!data.session) {
      router.push("/login");
      return;
    }

    router.refresh();
    if (role === "pemilik_kafe") {
      router.push("/owner/register-cafe");
    } else {
      router.push("/");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-semibold text-ink">Buat akun CafeHub</h1>
      <p className="mt-1 text-sm text-muted">Pilih jenis akun yang sesuai dengan Anda.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRole("mahasiswa")}
          className={`flex flex-col items-center gap-2 rounded-card border p-4 text-sm ${
            role === "mahasiswa"
              ? "border-ink bg-ink text-parchment"
              : "border-line text-ink/70"
          }`}
        >
          <GraduationCap size={20} />
          Pengunjung
        </button>
        <button
          type="button"
          onClick={() => setRole("pemilik_kafe")}
          className={`flex flex-col items-center gap-2 rounded-card border p-4 text-sm ${
            role === "pemilik_kafe"
              ? "border-ink bg-ink text-parchment"
              : "border-line text-ink/70"
          }`}
        >
          <Store size={20} />
          Pemilik kafe
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Nama lengkap</label>
          <input
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-ink/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-ink/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Kata sandi</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-ink/40"
          />
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? "Memproses..."
            : role === "pemilik_kafe"
            ? "Daftar & lanjut daftarkan kafe"
            : "Daftar"}
        </Button>

        {role === "pemilik_kafe" && (
          <p className="text-xs text-muted">
            Setelah mendaftar, Anda akan mengisi detail kafe (menu, jam
            operasional, fasilitas, meja). Kafe baru tampil ke publik setelah
            disetujui admin.
          </p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-ink underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}
