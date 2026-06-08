import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        paper: "#f7f8f5",
        mint: "#dff4ea",
        coral: "#ff7a68",
        marine: "#145c72",
        amber: "#f3b23c",
        "surface-elevated": "#ffffff",
        "surface-muted": "#f0f6f2"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 43, 0.08)",
        "soft-lg": "0 22px 60px rgba(23, 33, 43, 0.12)"
      },
      spacing: {
        "section-gap": "1.5rem"
      }
    },
  },
  plugins: [],
};

export default config;
