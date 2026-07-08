import Link from "next/link";
import { MapPin, Users, Armchair, Star } from "lucide-react";

interface CafeCardProps {
  id: number;
  nama: string;
  area: string;
  subscription_tier: "standar" | "premium";
  mejaTersedia: number;
  kapasitasTersedia: number;
  totalMeja: number;
  fasilitas: string[];
  ratingRata: number | null;
  jumlahUlasan: number;
}

export default function CafeCard({
  id,
  nama,
  area,
  subscription_tier,
  mejaTersedia,
  kapasitasTersedia,
  totalMeja,
  fasilitas,
  ratingRata,
  jumlahUlasan,
}: CafeCardProps) {
  const penuh = mejaTersedia === 0;

  return (
    <Link
      href={`/cafes/${id}`}
      className="group flex flex-col rounded-card border border-line bg-surface p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-ink group-hover:underline">
          {nama}
        </h3>
        {subscription_tier === "premium" && (
          <span className="shrink-0 rounded-full bg-brass-light px-2.5 py-0.5 text-[11px] font-medium text-brass-dark">
            Premium
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <MapPin size={14} />
        {area}
      </div>

      {ratingRata !== null && (
        <div className="mt-2 flex items-center gap-1 text-sm text-ink/80">
          <Star size={14} className="fill-brass text-brass" />
          <span className="font-medium">{ratingRata.toFixed(1)}</span>
          <span className="text-muted">({jumlahUlasan} ulasan)</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-sm">
        <span
          className={`flex items-center gap-1.5 font-medium ${
            penuh ? "text-rust" : "text-moss"
          }`}
        >
          <Armchair size={15} />
          {penuh ? "Penuh" : `${mejaTersedia}/${totalMeja} meja tersedia`}
        </span>
        {!penuh && (
          <span className="flex items-center gap-1.5 text-muted">
            <Users size={15} />
            {kapasitasTersedia} kursi kosong
          </span>
        )}
      </div>

      {fasilitas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {fasilitas.slice(0, 3).map((f) => (
            <span
              key={f}
              className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink/70"
            >
              {f}
            </span>
          ))}
          {fasilitas.length > 3 && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink/70">
              +{fasilitas.length - 3} lainnya
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
