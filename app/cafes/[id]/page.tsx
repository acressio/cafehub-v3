import { notFound } from "next/navigation";
import { MapPin, Clock, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "@/components/BookingForm";
import ReviewForm from "@/components/ReviewForm";

export const revalidate = 0;

export default async function CafeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const cafeId = Number(params.id);
  const supabase = createClient();

  const { data: cafe } = await supabase
    .from("cafes")
    .select("*")
    .eq("id", cafeId)
    .eq("status", "approved")
    .single();

  if (!cafe) notFound();

  const [
    { data: tables },
    { data: occupancy },
    { data: menus },
    { data: hours },
    { data: cafeFacilities },
    { data: facilities },
    { data: reviews },
    { data: auth },
  ] = await Promise.all([
    supabase.from("tables").select("*").eq("cafe_id", cafeId).order("nomor_meja"),
    supabase.from("public_table_occupancy").select("table_id"),
    supabase.from("menus").select("*").eq("cafe_id", cafeId),
    supabase.from("operating_hours").select("*").eq("cafe_id", cafeId),
    supabase.from("cafe_facilities").select("facility_id").eq("cafe_id", cafeId),
    supabase.from("facilities").select("*"),
    supabase
      .from("reviews")
      .select("*, users(nama)")
      .eq("cafe_id", cafeId)
      .eq("status_moderasi", "approved")
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const occupiedIds = new Set((occupancy ?? []).map((o: any) => o.table_id));
  const facilityNameById = new Map((facilities ?? []).map((f: any) => [f.id, f.nama_fasilitas]));
  const cafeFacilityNames = (cafeFacilities ?? [])
    .map((cf: any) => facilityNameById.get(cf.facility_id))
    .filter(Boolean);

  const tableOptions = (tables ?? []).map((t: any) => ({
    id: t.id,
    nomor_meja: t.nomor_meja,
    kapasitas: t.kapasitas,
    tersedia: !occupiedIds.has(t.id),
  }));

  const ratingRata =
    (reviews ?? []).length > 0
      ? (reviews ?? []).reduce((s: number, r: any) => s + r.rating, 0) / (reviews ?? []).length
      : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
              {cafe.nama}
            </h1>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
              <MapPin size={15} />
              {cafe.alamat}
            </div>
          </div>
          {cafe.subscription_tier === "premium" && (
            <span className="shrink-0 rounded-full bg-brass-light px-3 py-1 text-xs font-medium text-brass-dark">
              Premium
            </span>
          )}
        </div>

        {ratingRata !== null && (
          <div className="mt-3 flex items-center gap-1 text-sm">
            <Star size={15} className="fill-brass text-brass" />
            <span className="font-medium">{ratingRata.toFixed(1)}</span>
            <span className="text-muted">({(reviews ?? []).length} ulasan)</span>
          </div>
        )}

        {cafeFacilityNames.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cafeFacilityNames.map((f: string) => (
              <span key={f} className="rounded-full border border-line px-3 py-1 text-xs text-ink/70">
                {f}
              </span>
            ))}
          </div>
        )}

        {(hours ?? []).length > 0 && (
          <div className="mt-5 flex items-start gap-2 text-sm text-ink/80">
            <Clock size={16} className="mt-0.5 shrink-0" />
            <div>
              {(hours ?? []).map((h: any) => (
                <p key={h.id}>
                  {h.hari}: {h.jam_buka.slice(0, 5)} - {h.jam_tutup.slice(0, 5)}
                </p>
              ))}
            </div>
          </div>
        )}

        {(menus ?? []).length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-ink">Menu</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(menus ?? []).map((m: any) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-line px-4 py-2.5 text-sm"
                >
                  <span>{m.nama_menu}</span>
                  <span className="font-medium text-ink">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(m.harga)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-ink">Ulasan</h2>
          <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-ink">Ulasan</h2>

          <div className="my-4">
            <ReviewForm cafeId={cafeId} isLoggedIn={!!auth?.user} />
          </div>

          {(reviews ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada ulasan untuk kafe ini.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {(reviews ?? []).map((r: any) => (
                <div key={r.id} className="rounded-lg border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">{r.users?.nama ?? "Pengguna"}</p>
                    <div className="flex items-center gap-1 text-xs">
                      <Star size={13} className="fill-brass text-brass" />
                      {r.rating}
                    </div>
                  </div>
                  {r.komentar && <p className="mt-1.5 text-sm text-ink/70">{r.komentar}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:h-fit">
        <BookingForm cafeId={cafeId} tables={tableOptions} isLoggedIn={!!auth?.user} />
      </div>
    </div>
  );
}
