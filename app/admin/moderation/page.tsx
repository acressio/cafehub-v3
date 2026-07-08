"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/StatusBadge";
import { Flag, Star } from "lucide-react";

interface ReviewRow {
  id: number;
  rating: number;
  komentar: string | null;
  status_moderasi: string;
  dilaporkan: boolean;
  users: { nama: string } | null;
  cafes: { nama: string } | null;
}

export default function ModerationPage() {
  const supabase = createClient();
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", auth.user.id)
      .single();
    if (profile?.role !== "admin") {
      router.push("/");
      return;
    }

    const { data } = await supabase
      .from("reviews")
      .select("id, rating, komentar, status_moderasi, dilaporkan, users(nama), cafes(nama)")
      .or("status_moderasi.eq.pending,dilaporkan.eq.true")
      .order("id", { ascending: false });
    setReviews((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moderate(id: number, status_moderasi: "approved" | "rejected") {
    setBusyId(id);
    await supabase.from("reviews").update({ status_moderasi, dilaporkan: false }).eq("id", id);
    await load();
    setBusyId(null);
  }

  if (loading) return <p className="text-sm text-muted">Memuat ulasan...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Moderasi ulasan</h1>

      {reviews.length === 0 ? (
        <div className="rounded-card border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">Tidak ada ulasan yang perlu ditinjau.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ink">{r.cafes?.nama}</p>
                  <p className="text-sm text-muted">oleh {r.users?.nama}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.dilaporkan && (
                    <span className="flex items-center gap-1 text-xs text-rust">
                      <Flag size={12} /> Dilaporkan
                    </span>
                  )}
                  <StatusBadge status={r.status_moderasi} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-sm">
                <Star size={13} className="fill-brass text-brass" />
                {r.rating}
              </div>
              {r.komentar && <p className="mt-1 text-sm text-ink/70">{r.komentar}</p>}

              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={busyId === r.id} onClick={() => moderate(r.id, "approved")}>
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === r.id}
                  onClick={() => moderate(r.id, "rejected")}
                >
                  Sembunyikan
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
