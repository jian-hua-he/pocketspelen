import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

const isDev = process.env.NODE_ENV !== "production";

export default {
  base: "/pocketspelen/",
  build: { outDir: "docs" },
  plugins: [tailwindcss(), ...(isDev ? [basicSsl()] : [])],
  server: {
    allowedHosts: true,
  },
};
