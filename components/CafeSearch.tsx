"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import CafeCard from "./CafeCard";
import FacilityFilter from "./FacilityFilter";

export interface CafeSearchItem {
  id: number;
  nama: string;
  area: string;
  subscription_tier: "standar" | "premium";
  mejaTersedia: number;
  kapasitasTersedia: number;
  totalMeja: number;
  facilityIds: number[];
  fasilitas: string[];
  ratingRata: number | null;
  jumlahUlasan: number;
}

export default function CafeSearch({
  cafes,
  facilities,
  areas,
}: {
  cafes: CafeSearchItem[];
  facilities: { id: number; nama_fasilitas: string }[];
  areas: string[];
}) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const filtered = useMemo(() => {
    return cafes.filter((c) => {
      if (query && !c.nama.toLowerCase().includes(query.toLowerCase())) return false;
      if (area && c.area !== area) return false;
      if (onlyAvailable && c.mejaTersedia === 0) return false;
      if (
        selectedFacilities.length > 0 &&
        !selectedFacilities.every((id) => c.facilityIds.includes(id))
      )
        return false;
      return true;
    });
  }, [cafes, query, area, onlyAvailable, selectedFacilities]);

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama kafe..."
            className="w-full rounded-full border border-line bg-parchment py-2.5 pl-10 pr-4 text-sm focus:border-ink/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="rounded-full border border-line bg-parchment px-3.5 py-2 text-sm"
          >
            <option value="">Semua area</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-ink"
            />
            Hanya yang masih ada meja
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Fasilitas
          </p>
          <FacilityFilter
            facilities={facilities}
            selected={selectedFacilities}
            onChange={setSelectedFacilities}
          />
        </div>
      </div>

      <p className="mt-6 mb-3 text-sm text-muted">
        {filtered.length} kafe ditemukan
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-line p-10 text-center">
          <p className="font-display text-lg text-ink">Belum ada kafe yang cocok</p>
          <p className="mt-1 text-sm text-muted">
            Coba ubah kata kunci, area, atau kurangi filter fasilitas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CafeCard
              key={c.id}
              id={c.id}
              nama={c.nama}
              area={c.area}
              subscription_tier={c.subscription_tier}
              mejaTersedia={c.mejaTersedia}
              kapasitasTersedia={c.kapasitasTersedia}
              totalMeja={c.totalMeja}
              fasilitas={c.fasilitas}
              ratingRata={c.ratingRata}
              jumlahUlasan={c.jumlahUlasan}
            />
          ))}
        </div>
      )}
    </div>
  );
}
