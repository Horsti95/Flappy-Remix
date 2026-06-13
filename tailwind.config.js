/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        sky: {
          day: "#87ceeb",
          dusk: "#4a6fa5",
        },
        paper: "#f4ead5",
        ink: "#1a1a1a",
        // Semantic accents — consistent MEANING, not decoration. Use on
        // borders / icons / small chips, never as big button fills (keeps the
        // paper/ink calm). daily=warm, social=cyan, ranked=purple,
        // success=green, danger=red, system=neutral.
        accent: {
          daily: "#f59e0b",
          social: "#38bdf8",
          ranked: "#a855f7",
          success: "#34d399",
          danger: "#ef4444",
          system: "#9ca3af",
        },
      },
      fontFamily: {
        display: ["Caveat", "system-ui", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};
