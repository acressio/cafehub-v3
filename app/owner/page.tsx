"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/ui/Button";
import { Plus } from "lucide-react";

interface CafeRow {
  id: number;
  nama: string;
  area: string;
  status: string;
}

export default function OwnerDashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [cafes, setCafes] = useState<CafeRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

      if (profile?.role !== "pemilik_kafe") {
        router.push("/");
        return;
      }

      const { data: cafeRows } = await supabase
        .from("cafes")
        .select("id, nama, area, status")
        .order("created_at", { ascending: false });
      setCafes((cafeRows as CafeRow[]) ?? []);

      const cafeIds = (cafeRows ?? []).map((c: any) => c.id);
      if (cafeIds.length > 0) {
        const { data: tableRows } = await supabase
          .from("tables")
          .select("id")
          .in("cafe_id", cafeIds);
        const tableIds = (tableRows ?? []).map((t: any) => t.id);
        if (tableIds.length > 0) {
          const { count } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .in("table_id", tableIds)
            .in("status", ["pending", "confirmed"]);
          setPendingCount(count ?? 0);
        }
      }
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  if (loading) return <p className="text-sm text-muted">Memuat dasbor...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Dasbor pemilik kafe</h1>
        <Link href="/owner/register-cafe">
          <Button size="sm">
            <Plus size={15} /> Daftarkan kafe baru
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total kafe</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{cafes.length}</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Booking aktif</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{pendingCount}</p>
        </div>
        <Link
          href="/owner/bookings"
          className="flex items-center justify-center rounded-card border border-dashed border-line p-4 text-sm font-medium text-ink hover:border-ink/40"
        >
          Kelola booking &rarr;
        </Link>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Kafe Anda</h2>
      {cafes.length === 0 ? (
        <div className="rounded-card border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">Anda belum mendaftarkan kafe.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cafes.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-card border border-line bg-surface p-4"
            >
              <div>
                <p className="font-medium text-ink">{c.nama}</p>
                <p className="text-sm text-muted">{c.area}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
