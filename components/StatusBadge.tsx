type Tone = "moss" | "rust" | "brass" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  moss: "bg-moss-light text-moss border-moss/30",
  rust: "bg-rust-light text-rust border-rust/30",
  brass: "bg-brass-light text-brass-dark border-brass/30",
  muted: "bg-line/60 text-muted border-line",
};

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // booking
  pending: { label: "Menunggu pembayaran", tone: "brass" },
  confirmed: { label: "Terkonfirmasi", tone: "moss" },
  completed: { label: "Selesai", tone: "moss" },
  cancelled: { label: "Dibatalkan", tone: "muted" },
  expired: { label: "Hangus", tone: "rust" },
  // cafe
  pending_verification: { label: "Menunggu verifikasi", tone: "brass" },
  approved: { label: "Disetujui", tone: "moss" },
  rejected: { label: "Ditolak", tone: "rust" },
  // payment
  paid: { label: "Lunas", tone: "moss" },
  failed: { label: "Gagal", tone: "rust" },
  refunded: { label: "Dikembalikan", tone: "muted" },
  // review moderation
  reported: { label: "Dilaporkan", tone: "rust" },
};

export default function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, tone: "muted" as Tone };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[info.tone]}`}
    >
      {info.label}
    </span>
  );
}
