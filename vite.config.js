import tailwindcss from "@tailwindcss/vite";

export default {
  plugins: [tailwindcss()],
  server: {
    allowedHosts: true,
  },
};
