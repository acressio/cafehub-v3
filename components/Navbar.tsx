"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Coffee, Bell, LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types";

export default function Navbar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", auth.user.id)
        .single();
      if (!active) return;
      setProfile((data as AppUser) ?? null);

      if (data) {
        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", (data as AppUser).id)
          .eq("is_read", false);
        if (active) setUnread(count ?? 0);
      }
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const dashboardLink =
    profile?.role === "admin"
      ? "/admin"
      : profile?.role === "pemilik_kafe"
      ? "/owner"
      : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-parchment/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-parchment">
            <Coffee size={16} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            CafeHub
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm text-ink/80 hover:text-ink">
            Cari kafe
          </Link>
          {dashboardLink && (
            <Link href={dashboardLink} className="text-sm text-ink/80 hover:text-ink">
              Dasbor {profile?.role === "admin" ? "admin" : "pemilik"}
            </Link>
          )}
          {profile && (
            <Link
              href="/notifications"
              className="relative text-ink/80 hover:text-ink"
              aria-label="Notifikasi"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-rust text-[10px] font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
          {profile ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-ink/80 hover:text-ink"
            >
              <LogOut size={15} /> Keluar
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink/90"
            >
              Masuk
            </Link>
          )}
        </nav>

        <button
          className="md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-line px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/" onClick={() => setMenuOpen(false)} className="text-sm text-ink/80">
              Cari kafe
            </Link>
            {dashboardLink && (
              <Link href={dashboardLink} onClick={() => setMenuOpen(false)} className="text-sm text-ink/80">
                Dasbor {profile?.role === "admin" ? "admin" : "pemilik"}
              </Link>
            )}
            {profile && (
              <Link href="/notifications" onClick={() => setMenuOpen(false)} className="text-sm text-ink/80">
                Notifikasi {unread > 0 ? `(${unread})` : ""}
              </Link>
            )}
            {profile ? (
              <button onClick={handleLogout} className="text-left text-sm text-ink/80">
                Keluar
              </button>
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-ink">
                Masuk
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
