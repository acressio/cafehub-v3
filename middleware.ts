import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Refresh session Supabase dulu di setiap request.
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Jalankan di semua path KECUALI file statis & _next internal,
     * supaya sesi login tetap ter-refresh saat berpindah halaman.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
