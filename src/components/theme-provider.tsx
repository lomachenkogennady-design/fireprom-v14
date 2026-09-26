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
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemeKey,
  type ThemeKey,
} from "@/lib/theme";

interface ThemeStore {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  /** true после гидратации — до этого не рисуем выбранное состояние */
  ready: boolean;
}

const Ctx = createContext<ThemeStore | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  // Тему уже применил инлайн-скрипт в <head> — здесь только синхронизируем state
  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (isThemeKey(fromDom)) setThemeState(fromDom);
    setReady(true);
  }, []);

  const setTheme = useCallback((t: ThemeKey) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* приватный режим — просто не запоминаем */
    }
    setThemeState(t);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, ready }), [theme, setTheme, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme должен вызываться внутри <ThemeProvider>");
  return ctx;
}
