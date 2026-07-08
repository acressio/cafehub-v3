"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button";
import type { Notification } from "@/lib/types";
import { Bell, CheckCheck } from "lucide-react";

const TIPE_LABEL: Record<string, string> = {
  confirmation: "Konfirmasi",
  reminder: "Pengingat",
  expired: "Hangus",
  cancelled: "Dibatalkan",
  completed: "Selesai",
  payment: "Pembayaran",
  verification: "Verifikasi kafe",
};

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
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
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .single();

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile?.id)
        .order("created_at", { ascending: false });

      setItems((data as Notification[]) ?? []);
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  if (loading) return <p className="text-sm text-muted">Memuat notifikasi...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Notifikasi</h1>
        <Button variant="secondary" size="sm" onClick={markAllRead}>
          <CheckCheck size={15} /> Tandai semua dibaca
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line p-10 text-center">
          <Bell className="mx-auto mb-2 text-muted" size={24} />
          <p className="text-sm text-muted">Belum ada notifikasi.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-card border p-4 ${
                n.is_read ? "border-line bg-surface" : "border-brass/40 bg-brass-light"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  {TIPE_LABEL[n.tipe] ?? n.tipe}
                </span>
                <span className="text-xs text-muted">{formatDateTime(n.created_at)}</span>
              </div>
              <p className="mt-1 font-medium text-ink">{n.judul}</p>
              <p className="mt-0.5 text-sm text-ink/70">{n.pesan}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
