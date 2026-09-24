import type { Config } from "tailwindcss";
// Paleta de la marca con sus contrastes medidos: una sola fuente para las clases
// (bg-ink, text-ink-muted, border-line…) y para los componentes de src/components/ui.
import { colores } from "./src/components/ui/tokens";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Outfit: estructura (títulos, cifras, botones).
        display: ['var(--font-outfit)', 'sans-serif'],
        // DM Sans: texto corrido.
        body: ['var(--font-dm-sans)', 'sans-serif'],
        // Instrument Serif itálica: la voz humana (remate de un titular, un
        // estado vacío, una cita). Se carga en el layout raíz como --font-serif.
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      colors: {
        // ── Sistema de diseño (septiembre 2026): nombres semánticos ──
        // Úsalos en todo código nuevo. Los nombres viejos de abajo siguen
        // vivos hasta que cada página se rehaga; no se borran.
        ...colores,

        // ── Nombres heredados (no usar en código nuevo) ──
        // Custom brand colors
        "primary-dark-green": "#657F33",
        "primary-light-green": "#A8C43A",
        "primary-dark-blue": "#004AAD",
        "primary-light-blue": "#A8BED6",
        "background-beige": "#F3F1EB",
        black: "#333333",
        "custom-beige": "#e8e7d4",
        "soft-beige": "#F3F1EB",
        "title-dark": "#283739",
        "text-black": "#000000",
        "number-green": "#2b5d62",
        "button-orange": "#f48602",
        "button-green": "#9fbb2f",
        "button-dark-green": "#2b5d62",
        "button-title": "#283739",
        "soft-green": "#2b5d62",
        "lemon-green": "#9fbb2f",

        // shadcn/ui colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Sombras del registro de aplicación: suaves y teñidas de tinta, nunca negras.
      boxShadow: {
        "ap-1": "0 1px 2px rgb(40 55 57 / 0.06), 0 1px 1px rgb(40 55 57 / 0.04)",
        "ap-2": "0 6px 20px -8px rgb(40 55 57 / 0.18), 0 2px 4px -2px rgb(40 55 57 / 0.06)",
        "ap-3": "0 28px 60px -16px rgb(40 55 57 / 0.35), 0 8px 16px -8px rgb(40 55 57 / 0.12)",
      },
      transitionTimingFunction: {
        marca: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      maxWidth: {
        // El ÚNICO ancho máximo de página de la aplicación (lo pone el AppShell).
        app: "1400px",
        // Páginas de lectura (notificaciones, un mensaje): la lista se estrecha
        // POR DENTRO con max-w-lectura; la cabecera sigue a todo el ancho, así
        // el borde derecho no salta al navegar.
        lectura: "52rem",
      },
    },
  },
  plugins: [],
};

export default config;
