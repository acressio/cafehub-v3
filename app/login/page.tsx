"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Email atau kata sandi salah. Coba lagi.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", data.user.id)
      .single();

    router.refresh();
    if (profile?.role === "admin") router.push("/admin");
    else if (profile?.role === "pemilik_kafe") router.push("/owner");
    else router.push("/");
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-ink">Masuk ke CafeHub</h1>
      <p className="mt-1 text-sm text-muted">
        Kelola reservasi, kafe, atau verifikasi dari satu akun.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-ink/40"
            placeholder="nama@email.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Kata sandi</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-ink/40"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Memproses..." : "Masuk"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/register" className="font-medium text-ink underline">
          Daftar di sini
        </Link>
      </p>
    </div>
  );
}
