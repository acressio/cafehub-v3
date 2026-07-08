"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { formatRupiah } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";

const DEPOSIT = 10000;
const KOMISI = 1000;

export default function QrisPayment({ bookingId }: { bookingId: number }) {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "pending" | "paid">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function ensurePayment() {
      const { data: existing } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();

      if (existing) {
        setStatus(existing.status === "paid" ? "paid" : "pending");
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", auth.user?.id)
        .single();

      await supabase.from("payments").insert({
        booking_id: bookingId,
        user_id: profile?.id,
        jumlah: DEPOSIT,
        komisi_platform: KOMISI,
        metode: "qris",
        status: "pending",
      });
      setStatus("pending");
    }
    ensurePayment();
  }, [bookingId, supabase]);

  async function confirmPayment() {
    setProcessing(true);
    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("booking_id", bookingId);
    setStatus("paid");
    setProcessing(false);
    router.refresh();
  }

  if (status === "loading") {
    return <p className="text-sm text-muted">Menyiapkan pembayaran...</p>;
  }

  if (status === "paid") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-moss/30 bg-moss-light p-6 text-center">
        <CheckCircle2 className="text-moss" size={32} />
        <p className="font-medium text-moss">Pembayaran diterima</p>
        <p className="text-sm text-ink/70">
          Booking Anda sudah terkonfirmasi. Tunjukkan tiket ini saat tiba di kafe.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-6 text-center">
      <p className="text-sm text-muted">Deposit untuk mengunci meja</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">
        {formatRupiah(DEPOSIT)}
      </p>

      <div className="mx-auto my-5 flex h-52 w-52 items-center justify-center rounded-lg border border-dashed border-line bg-parchment">
        <svg viewBox="0 0 100 100" className="h-40 w-40 text-ink/80" aria-label="Kode QRIS">
          <rect x="5" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="70" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="5" y="70" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="13" y="13" width="9" height="9" fill="currentColor" />
          <rect x="78" y="13" width="9" height="9" fill="currentColor" />
          <rect x="13" y="78" width="9" height="9" fill="currentColor" />
          <rect x="40" y="10" width="6" height="6" fill="currentColor" />
          <rect x="55" y="20" width="6" height="6" fill="currentColor" />
          <rect x="40" y="40" width="20" height="20" fill="currentColor" />
          <rect x="70" y="45" width="6" height="6" fill="currentColor" />
          <rect x="45" y="65" width="6" height="6" fill="currentColor" />
          <rect x="60" y="75" width="18" height="18" fill="currentColor" />
          <rect x="20" y="45" width="6" height="6" fill="currentColor" />
        </svg>
      </div>

      <p className="text-xs text-muted">
        Pindai dengan aplikasi bank/e-wallet mana pun yang mendukung QRIS.
      </p>

      <Button onClick={confirmPayment} disabled={processing} className="mt-5 w-full">
        {processing ? "Memproses..." : "Saya sudah membayar"}
      </Button>
    </div>
  );
}
