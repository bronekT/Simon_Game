import type { Config } from "tailwindcss";

// Design tokens from SPEC.md Section 10 — dark, Apple-minimal.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0C",
        text: "#F5F5F7",
        muted: "#8A8A90",
        hairline: "rgba(255,255,255,.09)",
        accent: "#E9A23B",
        // Status colors
        won: "#3FD089",
        followup: "#F5B73D",
        risk: "#F0565D",
        task: "#5B8DEF",
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,.09)",
      },
      borderRadius: {
        card: "1rem",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
