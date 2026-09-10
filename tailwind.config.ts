import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        hsr: {
          bg: "#0b0d17",
          surface: "#141829",
          border: "#262b42",
          accent: "#f4c871",
          text: "#e8eaf4",
          muted: "#8a90ac",
        },
        element: {
          physical: "#b9b9b9",
          fire: "#f06464",
          ice: "#3c96d2",
          lightning: "#b464f0",
          wind: "#5ad2a0",
          quantum: "#6464c8",
          imaginary: "#e8d264",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Hiragino Sans",
          "Noto Sans JP",
          "Yu Gothic",
          "Meiryo",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
