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
      },
      fontFamily: {
        display: ["system-ui", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};
