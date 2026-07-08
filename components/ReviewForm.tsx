"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { Star } from "lucide-react";

export default function ReviewForm({
  cafeId,
  isLoggedIn,
}: {
  cafeId: number;
  isLoggedIn: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [komentar, setKomentar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (rating === 0) {
      setError("Pilih rating bintang terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", auth.user?.id)
      .single();

    const { error: insertError } = await supabase.from("reviews").insert({
      user_id: profile?.id,
      cafe_id: cafeId,
      rating,
      komentar: komentar || null,
    });

    if (insertError) {
      setError("Gagal mengirim ulasan. Coba lagi.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="rounded-card border border-moss/30 bg-moss-light p-4 text-sm text-moss">
        Terima kasih! Ulasan Anda sudah terkirim dan akan tampil setelah
        ditinjau.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-line bg-surface p-5"
    >
      <h3 className="font-display text-lg font-semibold text-ink">
        Beri ulasan
      </h3>

      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} bintang`}
          >
            <Star
              size={26}
              className={
                n <= (hoverRating || rating)
                  ? "fill-brass text-brass"
                  : "text-line"
              }
            />
          </button>
        ))}
      </div>

      <textarea
        value={komentar}
        onChange={(e) => setKomentar(e.target.value)}
        placeholder="Ceritakan pengalaman Anda (opsional)"
        rows={3}
        className="mt-3 w-full rounded-lg border border-line bg-parchment px-3.5 py-2.5 text-sm"
      />

      {error && <p className="mt-2 text-sm text-rust">{error}</p>}

      <Button type="submit" disabled={loading} className="mt-3 w-full">
        {loading
          ? "Mengirim..."
          : isLoggedIn
          ? "Kirim ulasan"
          : "Masuk untuk memberi ulasan"}
      </Button>
    </form>
  );
}
