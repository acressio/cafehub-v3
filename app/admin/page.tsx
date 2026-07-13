"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";

interface CafeRow {
  id: number;
  nama: string;
  alamat: string;
  area: string;
  status: string;
  created_at: string;
  users: { nama: string; email: string } | null;
}

interface ApprovedCafeRow {
  id: number;
  nama: string;
  subscription_tier: string;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [adminId, setAdminId] = useState<number | null>(null);
  const [cafes, setCafes] = useState<CafeRow[]>([]);
  const [approvedCafes, setApprovedCafes] = useState<ApprovedCafeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [note, setNote] = useState<Record<number, string>>({});

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_user_id", auth.user.id)
      .single();

    if (profile?.role !== "admin") {
      router.push("/");
      return;
    }
    setAdminId(profile.id);

    const { data } = await supabase
      .from("cafes")
      .select("id, nama, alamat, area, status, created_at, users(nama, email)")
      .eq("status", "pending_verification")
      .order("created_at", { ascending: true });
    setCafes((data as any) ?? []);

    const { data: approved } = await supabase
      .from("cafes")
      .select("id, nama, subscription_tier")
      .eq("status", "approved")
      .order("nama");
    setApprovedCafes((approved as any) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(cafeId: number, keputusan: "approved" | "rejected") {
    if (!adminId) return;
    setBusyId(cafeId);
    await supabase.from("cafe_verification_log").insert({
      cafe_id: cafeId,
      admin_id: adminId,
      keputusan,
      catatan: note[cafeId] || null,
    });
    await load();
    setBusyId(null);
  }

  async function updateTier(cafeId: number, tier: string) {
    await supabase.from("cafes").update({ subscription_tier: tier }).eq("id", cafeId);
    setApprovedCafes((prev) =>
      prev.map((c) => (c.id === cafeId ? { ...c, subscription_tier: tier } : c))
    );
  }

  if (loading) return <p className="text-sm text-muted">Memuat dasbor admin...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Verifikasi kafe</h1>
      </div>

      {cafes.length === 0 ? (
        <div className="rounded-card border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">Tidak ada kafe yang menunggu verifikasi.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cafes.map((c) => (
            <div key={c.id} className="rounded-card border border-line bg-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">{c.nama}</p>
                  <p className="text-sm text-muted">{c.alamat}</p>
                  <p className="text-sm text-muted">Area: {c.area}</p>
                  <p className="mt-1 text-xs text-muted">
                    Diajukan oleh {c.users?.nama} ({c.users?.email}) &middot;{" "}
                    {formatDateTime(c.created_at)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <textarea
                value={note[c.id] ?? ""}
                onChange={(e) => setNote((prev) => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="Catatan verifikasi (opsional, wajib diisi jika menolak)"
                className="mt-3 w-full rounded-lg border border-line bg-parchment px-3 py-2 text-sm"
                rows={2}
              />

              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={busyId === c.id} onClick={() => decide(c.id, "approved")}>
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === c.id}
                  onClick={() => decide(c.id, "rejected")}
                >
                  Tolak
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 font-display text-lg font-semibold text-ink">
        Paket langganan kafe
      </h2>
      {approvedCafes.length === 0 ? (
        <p className="text-sm text-muted">Belum ada kafe yang disetujui.</p>
      ) : (
        <div className="space-y-2">
          {approvedCafes.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-card border border-line bg-surface p-4"
            >
              <p className="font-medium text-ink">{c.nama}</p>
              <select
                value={c.subscription_tier}
                onChange={(e) => updateTier(c.id, e.target.value)}
                className="rounded-full border border-line bg-parchment px-3 py-1.5 text-sm"
              >
                <option value="standar">Standar</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
