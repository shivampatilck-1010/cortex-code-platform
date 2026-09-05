import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Outfit", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "Monaco", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        cortex: {
          DEFAULT: "#ff9100",
          hover: "#e68200",
          light: "#ffa726",
          dark: "#cc7400",
          bg: "#0b0c0e",
          sidebar: "#3d3c3b",
        },
        editor: {
          bg: "#0b0c0e",
          sidebar: "#3d3c3b",
          active: "#4a4948",
          border: "#2b2a29",
          gutter: "#858585"
        }
      },
    },
  },
  plugins: [],
};
export default config;
