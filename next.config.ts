import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El indicador de Next tapa la barra inferior en el celular.
  devIndicators: false,
  experimental: {
    // Fotos de lotes y campos: el navegador las achica (~0,5 MB), esto deja margen.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
