import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QrisPayment from "@/components/QrisPayment";
import BookingTicket from "@/components/BookingTicket";

export const revalidate = 0;

export default async function BookingPaymentPage({
  params,
}: {
  params: { id: string };
}) {
  const bookingId = Number(params.id);
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, tables(nomor_meja, kapasitas, cafe_id, cafes(nama))")
    .eq("id", bookingId)
    .single();

  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-center font-display text-2xl font-semibold text-ink">
        Selesaikan pembayaran
      </h1>

      <div className="mb-6">
        <BookingTicket
          bookingId={booking.id}
          cafeNama={booking.tables.cafes.nama}
          nomorMeja={booking.tables.nomor_meja}
          kapasitas={booking.tables.kapasitas}
          waktuMulai={booking.waktu_mulai}
          status={booking.status}
        />
      </div>

      {booking.status === "pending" ? (
        <QrisPayment bookingId={booking.id} />
      ) : (
        <p className="text-center text-sm text-muted">
          Booking ini sudah berstatus &ldquo;{booking.status}&rdquo;, tidak perlu pembayaran lagi.
        </p>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/notifications" className="text-ink underline">
          Lihat semua notifikasi booking
        </Link>
      </p>
    </div>
  );
}
