import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Founder Voice",
    short_name: "Founder Voice",
    description: "Voice-true content packs for B2B founders.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#173f34",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
