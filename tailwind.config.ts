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
        border: {
          subtle: "#20222A",
          DEFAULT: "hsl(var(--border))",
          focus: "#3F4457",
        },
        bg: {
          main: "#0B0C0E",
          surface: "#111216",
          secondary: "#15161C",
          tertiary: "#1A1C24",
        },
        accent: {
          primary: "#FF9100",
          whiteboard: "#06B6D4",
          workspace: "#A855F7",
          success: "#10B981",
          danger: "#F43F5E",
          warning: "#F59E0B",
        },
        text: {
          main: "#F5F5F5",
          secondary: "#A1A1AA",
          muted: "#71717A",
        },
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
      boxShadow: {
        panel: "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
        elevated: "0 8px 30px -4px rgba(0, 0, 0, 0.65)",
        "glow-primary": "0 0 20px -5px rgba(255, 145, 0, 0.3)",
        "glow-cyan": "0 0 20px -5px rgba(6, 182, 212, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
