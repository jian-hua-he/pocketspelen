import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default {
  plugins: [tailwindcss(), basicSsl()],
  server: {
    allowedHosts: true,
  },
};
