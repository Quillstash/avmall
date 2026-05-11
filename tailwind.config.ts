import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        brand: {
          primary: "hsl(var(--brand-primary) / <alpha-value>)",
          "primary-hover": "hsl(var(--brand-primary-hover) / <alpha-value>)",
          "primary-fg": "hsl(var(--brand-primary-fg) / <alpha-value>)",
          accent: "hsl(var(--brand-accent) / <alpha-value>)",
          "accent-hover": "hsl(var(--brand-accent-hover) / <alpha-value>)",
        },
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        fg: "hsl(var(--fg) / <alpha-value>)",
        "fg-muted": "hsl(var(--fg-muted) / <alpha-value>)",
        "fg-subtle": "hsl(var(--fg-subtle) / <alpha-value>)",
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          bg: "hsl(var(--success-bg) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          bg: "hsl(var(--warning-bg) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          bg: "hsl(var(--danger-bg) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          bg: "hsl(var(--info-bg) / <alpha-value>)",
        },
        status: {
          pending: "hsl(var(--status-pending) / <alpha-value>)",
          confirmed: "hsl(var(--status-confirmed) / <alpha-value>)",
          processing: "hsl(var(--status-processing) / <alpha-value>)",
          shipped: "hsl(var(--status-shipped) / <alpha-value>)",
          delivered: "hsl(var(--status-delivered) / <alpha-value>)",
          cancelled: "hsl(var(--status-cancelled) / <alpha-value>)",
          refunded: "hsl(var(--status-refunded) / <alpha-value>)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        focus: "var(--shadow-focus)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        display: ["var(--font-display)"],
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
        "4xl": "var(--text-4xl)",
        "5xl": "var(--text-5xl)",
      },
      transitionDuration: {
        micro: "150ms",
        small: "200ms",
        medium: "250ms",
        page: "300ms",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
      },
    },
  },
  plugins: [],
};

export default config;
