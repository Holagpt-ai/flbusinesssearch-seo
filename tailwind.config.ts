import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: "#E8824A",
          dark: "#D4713A",
          light: "#FDF0E8",
          faint: "#FEF8F4",
        },
        teal: {
          DEFAULT: "#2A7F6F",
          light: "#EBF5F3",
          dark: "#1F6558",
        },
        coral: {
          DEFAULT: "#E85A4A",
          light: "#FDF0EE",
        },
        cream: "#FAF8F5",
        "warm-black": "#1A1A1A",
        "warm-gray": "#6B6B6B",
        "warm-muted": "#9B9B9B",
        "border-custom": "#E8E4DC",
        "border-dark": "#D4CFC6",
        gold: "#D4A853",
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
