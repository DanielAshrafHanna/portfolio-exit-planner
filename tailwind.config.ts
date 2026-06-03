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
        amber: "#f3b23c"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 43, 0.08)"
      }
    },
  },
  plugins: [],
};

export default config;
