"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/StatusBadge";
import Button from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";

interface BookingRow {
  id: number;
  waktu_mulai: string;
  status: string;
  users: { nama: string } | null;
  tables: { nomor_meja: string; cafes: { nama: string } | null } | null;
}

export default function OwnerBookingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("id, waktu_mulai, status, users(nama), tables(nomor_meja, cafes(nama))")
      .order("waktu_mulai", { ascending: true });
    setBookings((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: number, status: "completed" | "cancelled") {
    setBusyId(id);
    await supabase.from("bookings").update({ status }).eq("id", id);
    await load();
    setBusyId(null);
  }

  if (loading) return <p className="text-sm text-muted">Memuat booking...</p>;

  const aktif = bookings.filter((b) => ["pending", "confirmed"].includes(b.status));
  const riwayat = bookings.filter((b) => !["pending", "confirmed"].includes(b.status));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Kelola booking</h1>

      <h2 className="mb-3 font-medium text-ink">Perlu tindakan ({aktif.length})</h2>
      {aktif.length === 0 ? (
        <p className="mb-8 text-sm text-muted">Tidak ada booking aktif saat ini.</p>
      ) : (
        <div className="mb-8 space-y-2">
          {aktif.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-ink">
                  {b.tables?.cafes?.nama} &middot; Meja {b.tables?.nomor_meja}
                </p>
                <p className="text-sm text-muted">
                  {b.users?.nama} &middot; {formatDateTime(b.waktu_mulai)}
                </p>
                <div className="mt-1">
                  <StatusBadge status={b.status} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busyId === b.id}
                  onClick={() => updateStatus(b.id, "completed")}
                >
                  Pelanggan datang
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busyId === b.id}
                  onClick={() => updateStatus(b.id, "cancelled")}
                >
                  Tidak hadir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 font-medium text-ink">Riwayat</h2>
      {riwayat.length === 0 ? (
        <p className="text-sm text-muted">Belum ada riwayat booking.</p>
      ) : (
        <div className="space-y-2">
          {riwayat.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-card border border-line bg-surface p-4"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {b.tables?.cafes?.nama} &middot; Meja {b.tables?.nomor_meja}
                </p>
                <p className="text-xs text-muted">
                  {b.users?.nama} &middot; {formatDateTime(b.waktu_mulai)}
                </p>
              </div>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
