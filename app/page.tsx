import { createClient } from "@/lib/supabase/server";
import CafeSearch, { type CafeSearchItem } from "@/components/CafeSearch";

export const revalidate = 0;

export default async function HomePage() {
  const supabase = createClient();

  const [
    { data: cafes },
    { data: facilities },
    { data: cafeFacilities },
    { data: capacity },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("cafes")
      .select("id, nama, area, subscription_tier")
      .eq("status", "approved")
      .order("nama"),
    supabase.from("facilities").select("id, nama_fasilitas").order("nama_fasilitas"),
    supabase.from("cafe_facilities").select("cafe_id, facility_id"),
    supabase.from("public_cafe_capacity").select("*"),
    supabase
      .from("reviews")
      .select("cafe_id, rating")
      .eq("status_moderasi", "approved"),
  ]);

  const facilityNameById = new Map(
    (facilities ?? []).map((f: any) => [f.id, f.nama_fasilitas])
  );

  const items: CafeSearchItem[] = (cafes ?? []).map((c: any) => {
    const facilityIds = (cafeFacilities ?? [])
      .filter((cf: any) => cf.cafe_id === c.id)
      .map((cf: any) => cf.facility_id);
    const cap = (capacity ?? []).find((x: any) => x.cafe_id === c.id);
    const cafeReviews = (reviews ?? []).filter((r: any) => r.cafe_id === c.id);
    const ratingRata =
      cafeReviews.length > 0
        ? cafeReviews.reduce((s: number, r: any) => s + r.rating, 0) / cafeReviews.length
        : null;

    return {
      id: c.id,
      nama: c.nama,
      area: c.area,
      subscription_tier: c.subscription_tier,
      mejaTersedia: cap?.meja_tersedia ?? 0,
      kapasitasTersedia: cap?.kapasitas_tersedia ?? 0,
      totalMeja: cap?.total_meja ?? 0,
      facilityIds,
      fasilitas: facilityIds.map((id: number) => facilityNameById.get(id)).filter(Boolean),
      ratingRata,
      jumlahUlasan: cafeReviews.length,
    };
  });

  const areas = Array.from(new Set(items.map((i) => i.area))).sort();

  return (
    <div>
      <section className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Temukan meja kafe yang pas, tanpa datang lalu kecewa
        </h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          Lihat ketersediaan meja secara langsung, pesan dari mana saja, dan
          kunci tempat duduk Anda sebelum berangkat.
        </p>
      </section>

      <CafeSearch cafes={items} facilities={facilities ?? []} areas={areas} />
    </div>
  );
}
