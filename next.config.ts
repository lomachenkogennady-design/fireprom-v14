import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * standalone — самодостаточный сервер в .next/standalone: Next трассирует
   * только нужные модули, поэтому в контейнер не едет весь node_modules.
   * Итог: образ ~150 МБ и запуск в 0.5 ГБ RAM (Amvera / ONREZA free).
   */
  output: "standalone",

  // pdfkit читает data-файлы с диска — не бандлим
  serverExternalPackages: ["pdfkit"],

  // На маломощных тарифах телеметрия только мешает сборке
  productionBrowserSourceMaps: false,

  // ⚡ Обход бага SWC WASM на Android/ARM (09.10.2026)
  // TypeScript-воркер падает с "invalid type: unit value, expected usize"
  // Typecheck отдельно: npm run typecheck
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.pexels.com" }],
  },
};

export default nextConfig;
