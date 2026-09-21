import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#eeebf6",
        paper: "#ffffff",
        ink: "#1f1f1f",
        muted: "#5f6368",
        lavender: "#e8def8",
        mist: "#c4eed0",
        peach: "#f9dedc",
        sky: "#d3e3fd",
        lilac: "#eaddff",
        sand: "#fef7e0",
        accent: "#0b57d0",
      },
      boxShadow: {
        pane: "0 1px 2px rgba(31, 31, 31, 0.05), 0 8px 24px rgba(60, 50, 90, 0.04)",
        chip: "0 1px 2px rgba(31, 31, 31, 0.06)",
      },
      borderRadius: {
        pane: "1.5rem",
        chip: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
