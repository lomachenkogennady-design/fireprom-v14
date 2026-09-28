"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemeKey,
  themeForPath,
  type ThemeKey,
} from "@/lib/theme";

interface ThemeStore {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  setThemeAuto: () => void;
  isAuto: boolean;
  ready: boolean;
}

const Ctx = createContext<ThemeStore | null>(null);

function readManual(): ThemeKey | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw || raw === "auto") return null;
    return isThemeKey(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);
  const [isAuto, setIsAuto] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (isThemeKey(fromDom)) setThemeState(fromDom);
    setIsAuto(readManual() === null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (readManual() !== null) return;
    const next = themeForPath(pathname ?? "/");
    document.documentElement.dataset.theme = next;
    setThemeState(next);
  }, [pathname, ready]);

  const setTheme = useCallback((t: ThemeKey) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* приватный режим */
    }
    setThemeState(t);
    setIsAuto(false);
  }, []);

  const setThemeAuto = useCallback(() => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const next = themeForPath(window.location.pathname);
    document.documentElement.dataset.theme = next;
    setThemeState(next);
    setIsAuto(true);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, setThemeAuto, isAuto, ready }),
    [theme, setTheme, setThemeAuto, isAuto, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme должен вызываться внутри <ThemeProvider>");
  return ctx;
}
