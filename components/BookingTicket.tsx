import StatusBadge from "./StatusBadge";
import { formatDateTime } from "@/lib/format";

interface BookingTicketProps {
  bookingId: number;
  cafeNama: string;
  nomorMeja: string;
  kapasitas: number;
  waktuMulai: string;
  status: string;
}

// Elemen signature: tiket booking dibuat menyerupai nota antrian kafe
// fisik -- ada "sobekan" bergerigi di tengah yang memisahkan info kafe
// dari kode booking, dipertegas dengan font mono seperti mesin kasir.
export default function BookingTicket({
  bookingId,
  cafeNama,
  nomorMeja,
  kapasitas,
  waktuMulai,
  status,
}: BookingTicketProps) {
  const kode = `CH-${String(bookingId).padStart(6, "0")}`;

  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-card border border-line bg-surface shadow-sm">
      <div className="space-y-3 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Tiket reservasi
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">
              {cafeNama}
            </h3>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
          <div>
            <p className="text-muted">Meja</p>
            <p className="font-medium text-ink">{nomorMeja}</p>
          </div>
          <div>
            <p className="text-muted">Kapasitas</p>
            <p className="font-medium text-ink">{kapasitas} orang</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted">Waktu kedatangan</p>
            <p className="font-medium text-ink">{formatDateTime(waktuMulai)}</p>
          </div>
        </div>
      </div>

      {/* garis sobekan tiket */}
      <div className="relative flex items-center">
        <div className="absolute -left-3 h-6 w-6 rounded-full bg-parchment" />
        <div className="w-full border-t border-dashed border-line" />
        <div className="absolute -right-3 h-6 w-6 rounded-full bg-parchment" />
      </div>

      <div className="flex items-center justify-between bg-ink px-6 py-4 text-parchment">
        <span className="text-xs uppercase tracking-wide text-parchment/60">
          Kode booking
        </span>
        <span className="font-mono text-base tracking-widest">{kode}</span>
      </div>
    </div>
  );
}
