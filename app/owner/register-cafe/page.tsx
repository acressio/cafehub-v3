"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { Plus, Trash2 } from "lucide-react";

interface TableRow {
  nomor_meja: string;
  kapasitas: string;
}
interface MenuRow {
  nama_menu: string;
  harga: string;
  kategori: "makanan" | "minuman" | "snack";
}
interface Facility {
  id: number;
  nama_fasilitas: string;
}

export default function RegisterCafePage() {
  const supabase = createClient();
  const router = useRouter();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);

  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [area, setArea] = useState("");
  const [jamBuka, setJamBuka] = useState("08:00");
  const [jamTutup, setJamTutup] = useState("21:00");
  const [tables, setTables] = useState<TableRow[]>([{ nomor_meja: "M1", kapasitas: "2" }]);
  const [menus, setMenus] = useState<MenuRow[]>([
    { nama_menu: "", harga: "", kategori: "minuman" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function guardAndLoad() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", auth.user.id)
        .single();
      if (profile?.role !== "pemilik_kafe") {
        router.push("/");
        return;
      }
      const { data } = await supabase.from("facilities").select("*").order("nama_fasilitas");
      setFacilities((data as Facility[]) ?? []);
    }
    guardAndLoad();
  }, [router, supabase]);

  function updateTable(idx: number, field: keyof TableRow, value: string) {
    setTables((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  }
  function updateMenu(idx: number, field: keyof MenuRow, value: string) {
    setMenus((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nama || !alamat || !area) {
      setError("Nama, alamat, dan area wajib diisi.");
      return;
    }
    if (tables.some((t) => !t.nomor_meja || !t.kapasitas)) {
      setError("Lengkapi nomor meja dan kapasitas setiap meja.");
      return;
    }

    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", auth.user?.id)
      .single();

    const { data: cafe, error: cafeError } = await supabase
      .from("cafes")
      .insert({ owner_id: profile?.id, nama, alamat, area })
      .select()
      .single();

    if (cafeError || !cafe) {
      setError("Gagal menyimpan data kafe. Coba lagi.");
      setLoading(false);
      return;
    }

    await Promise.all([
      supabase.from("tables").insert(
        tables.map((t) => ({
          cafe_id: cafe.id,
          nomor_meja: t.nomor_meja,
          kapasitas: Number(t.kapasitas),
        }))
      ),
      supabase.from("operating_hours").insert({
        cafe_id: cafe.id,
        hari: "Senin-Minggu",
        jam_buka: jamBuka,
        jam_tutup: jamTutup,
      }),
      menus.some((m) => m.nama_menu)
        ? supabase.from("menus").insert(
            menus
              .filter((m) => m.nama_menu)
              .map((m) => ({
                cafe_id: cafe.id,
                nama_menu: m.nama_menu,
                harga: Number(m.harga || 0),
                kategori: m.kategori,
              }))
          )
        : Promise.resolve(),
      selectedFacilities.length > 0
        ? supabase
            .from("cafe_facilities")
            .insert(selectedFacilities.map((facility_id) => ({ cafe_id: cafe.id, facility_id })))
        : Promise.resolve(),
    ]);

    router.push("/owner");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink">Daftarkan kafe baru</h1>
      <p className="mt-1 text-sm text-muted">
        Lengkapi detail kafe Anda. Kafe akan tampil ke publik setelah
        diperiksa dan disetujui oleh admin CafeHub.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        <section className="space-y-4">
          <h2 className="font-medium text-ink">Informasi dasar</h2>
          <div>
            <label className="mb-1 block text-sm text-ink">Nama kafe</label>
            <input
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink">Alamat lengkap</label>
            <input
              required
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink">Area / kecamatan</label>
            <input
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="mis. Lowokwaru"
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-ink">Jam buka</label>
              <input
                type="time"
                value={jamBuka}
                onChange={(e) => setJamBuka(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink">Jam tutup</label>
              <input
                type="time"
                value={jamTutup}
                onChange={(e) => setJamTutup(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-ink">Meja & kapasitas</h2>
            <button
              type="button"
              onClick={() =>
                setTables((prev) => [...prev, { nomor_meja: `M${prev.length + 1}`, kapasitas: "2" }])
              }
              className="flex items-center gap-1 text-sm text-ink underline"
            >
              <Plus size={14} /> Tambah meja
            </button>
          </div>
          {tables.map((t, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={t.nomor_meja}
                onChange={(e) => updateTable(idx, "nomor_meja", e.target.value)}
                placeholder="Nomor meja"
                className="w-28 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                value={t.kapasitas}
                onChange={(e) => updateTable(idx, "kapasitas", e.target.value)}
                placeholder="Kapasitas"
                className="w-28 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
              {tables.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTables((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rust"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-ink">Menu (opsional)</h2>
            <button
              type="button"
              onClick={() =>
                setMenus((prev) => [...prev, { nama_menu: "", harga: "", kategori: "minuman" }])
              }
              className="flex items-center gap-1 text-sm text-ink underline"
            >
              <Plus size={14} /> Tambah menu
            </button>
          </div>
          {menus.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={m.nama_menu}
                onChange={(e) => updateMenu(idx, "nama_menu", e.target.value)}
                placeholder="Nama menu"
                className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                value={m.harga}
                onChange={(e) => updateMenu(idx, "harga", e.target.value)}
                placeholder="Harga"
                className="w-28 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
              <select
                value={m.kategori}
                onChange={(e) => updateMenu(idx, "kategori", e.target.value)}
                className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
              >
                <option value="minuman">Minuman</option>
                <option value="makanan">Makanan</option>
                <option value="snack">Snack</option>
              </select>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-medium text-ink">Fasilitas</h2>
          <div className="flex flex-wrap gap-2">
            {facilities.map((f) => {
              const active = selectedFacilities.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setSelectedFacilities((prev) =>
                      active ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    active ? "border-ink bg-ink text-parchment" : "border-line text-ink/70"
                  }`}
                >
                  {f.nama_fasilitas}
                </button>
              );
            })}
          </div>
        </section>

        {error && <p className="text-sm text-rust">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Menyimpan..." : "Kirim untuk diverifikasi"}
        </Button>
      </form>
    </div>
  );
}
