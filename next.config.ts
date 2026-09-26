import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * standalone — самодостаточный сервер в .next/standalone: Next трассирует
   * только нужные модули, поэтому в контейнер не едет весь node_modules.
   * Итог: образ ~150 МБ и запуск в 0.5 ГБ RAM (Amvera / ONREZA free).
   */
  output: "standalone",

  // На маломощных тарифах телеметрия только мешает сборке
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.pexels.com" }],
  },
};

export default nextConfig;
