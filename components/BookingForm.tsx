"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { Armchair, Users } from "lucide-react";

interface TableOption {
  id: number;
  nomor_meja: string;
  kapasitas: number;
  tersedia: boolean;
}

export default function BookingForm({
  cafeId,
  tables,
  isLoggedIn,
}: {
  cafeId: number;
  tables: TableOption[];
  isLoggedIn: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tableId, setTableId] = useState<number | null>(null);
  const [waktu, setWaktu] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBooking() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (!tableId || !waktu) {
      setError("Pilih meja dan waktu kedatangan terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("create_booking_atomic", {
      p_table_id: tableId,
      p_waktu_mulai: new Date(waktu).toISOString(),
    });

    if (rpcError) {
      setError(
        rpcError.message.includes("penuh")
          ? "Meja ini baru saja dipesan orang lain. Silakan pilih meja lain."
          : "Booking gagal dibuat. Coba lagi sebentar lagi."
      );
      setLoading(false);
      return;
    }

    router.push(`/booking/${data.id}/payment`);
  }

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h3 className="font-display text-lg font-semibold text-ink">Pesan meja</h3>

      <div className="mt-4 space-y-2">
        {tables.map((t) => (
          <label
            key={t.id}
            className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm ${
              !t.tersedia
                ? "cursor-not-allowed border-line bg-line/30 text-muted"
                : tableId === t.id
                ? "border-ink bg-ink text-parchment"
                : "border-line hover:border-ink/40"
            }`}
          >
            <span className="flex items-center gap-2">
              <Armchair size={16} />
              Meja {t.nomor_meja}
            </span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Users size={14} />
                {t.kapasitas}
              </span>
              {t.tersedia ? (
                <input
                  type="radio"
                  name="table"
                  checked={tableId === t.id}
                  onChange={() => setTableId(t.id)}
                />
              ) : (
                <span className="text-xs">Terisi</span>
              )}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-ink">
          Waktu kedatangan
        </label>
        <input
          type="datetime-local"
          value={waktu}
          min={minDateTime}
          onChange={(e) => setWaktu(e.target.value)}
          className="w-full rounded-lg border border-line bg-parchment px-3.5 py-2.5 text-sm"
        />
      </div>

      {error && <p className="mt-3 text-sm text-rust">{error}</p>}

      <Button onClick={handleBooking} disabled={loading} className="mt-4 w-full">
        {loading ? "Memproses..." : isLoggedIn ? "Pesan meja ini" : "Masuk untuk memesan"}
      </Button>

      <p className="mt-3 text-xs text-muted">
        Batas waktu konfirmasi 30 menit sejak booking dibuat. Bayar deposit
        QRIS untuk mengunci meja Anda.
      </p>
    </div>
  );
}
