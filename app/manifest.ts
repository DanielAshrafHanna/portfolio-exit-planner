import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portfolio Exit Planner",
    short_name: "Exit Planner",
    description: "Portfolio exit planning for US and Egyptian market holdings.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f5",
    theme_color: "#145c72",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
