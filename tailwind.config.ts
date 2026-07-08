import type { Config } from "tailwindcss";

// Design tokens CafeHub v3
// - ink       : teks utama & header, charcoal hangat (bukan hitam pekat)
// - parchment : latar utama, seperti kertas nota kafe
// - brass     : aksen utama (tombol, harga, highlight) - kuningan pudar
// - moss      : status positif (tersedia / disetujui / lunas)
// - rust      : status peringatan (penuh / ditolak / hangus)
// - line      : garis pembatas & border kartu
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#211F1B",
        parchment: "#FAF7F0",
        surface: "#FFFFFF",
        brass: {
          DEFAULT: "#9C7A3C",
          dark: "#7A5F2E",
          light: "#EFE4CB",
        },
        moss: {
          DEFAULT: "#4B6B4F",
          light: "#E4EDE3",
        },
        rust: {
          DEFAULT: "#A6503A",
          light: "#F3E1DB",
        },
        line: "#E4DED0",
        muted: "#8A8474",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "0.625rem",
      },
    },
  },
  plugins: [],
};

export default config;
