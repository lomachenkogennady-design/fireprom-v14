import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JarvisProvider } from "@/lib/jarvis/provider";
import { JarvisPanel } from "@/components/jarvis/jarvis-panel";
import { ThemeProvider } from "@/components/theme-provider";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});
const jbm = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jbm",
});
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-unbounded",
});

export const metadata: Metadata = {
  title: "ФАЙЕРПРОМ Metalworks — единый портал расчётов",
  description:
    "Инженерный расчёт гибки и развёрток, коммерческие предложения, DXF и единая история — в одном портале.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme перезаписывается скриптом ниже → гасим предупреждение гидратации
    <html lang="ru" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        {/* применяем сохранённую тему до первой отрисовки */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${jbm.variable} ${unbounded.variable} bg-bg text-ink antialiased`}
      >
        <div className="app-bg" />
        <ThemeProvider>
          <JarvisProvider>
            <SiteHeader />
            <main className="app-shell relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
              {children}
            </main>
            <SiteFooter />
            <JarvisPanel />
          </JarvisProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
