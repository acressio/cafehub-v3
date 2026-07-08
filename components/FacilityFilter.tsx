"use client";

interface Facility {
  id: number;
  nama_fasilitas: string;
}

export default function FacilityFilter({
  facilities,
  selected,
  onChange,
}: {
  facilities: Facility[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {facilities.map((f) => {
        const active = selected.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => toggle(f.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active
                ? "border-ink bg-ink text-parchment"
                : "border-line bg-surface text-ink/70 hover:border-ink/40"
            }`}
          >
            {f.nama_fasilitas}
          </button>
        );
      })}
    </div>
  );
}
