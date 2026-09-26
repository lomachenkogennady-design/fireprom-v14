"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { JarvisSnapshot, JarvisMessage } from "./types";

interface JarvisStore {
  snapshot: JarvisSnapshot;
  setSnapshot: (s: JarvisSnapshot) => void;
  messages: JarvisMessage[];
  pushMessage: (m: JarvisMessage) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  /** счётчик непрочитанных ответов, когда панель закрыта */
  unread: number;
}

const Ctx = createContext<JarvisStore | null>(null);

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<JarvisSnapshot>({
    kind: "idle",
    page: "/",
  });
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [open, setOpenState] = useState(false);
  const [unread, setUnread] = useState(0);

  const pushMessage = useCallback((m: JarvisMessage) => {
    setMessages((prev) => [...prev, m]);
    if (m.role === "assistant") {
      setUnread((u) => u + 1);
    }
  }, []);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (v) setUnread(0);
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  const value = useMemo<JarvisStore>(
    () => ({ snapshot, setSnapshot, messages, pushMessage, clear, open, setOpen, unread }),
    [snapshot, messages, pushMessage, clear, open, setOpen, unread]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJarvis(): JarvisStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJarvis должен вызываться внутри <JarvisProvider>");
  return ctx;
}

/**
 * Публикация состояния модуля в Jarvis.
 *
 * Снимок пересоздаётся на каждый рендер калькулятора, поэтому сравниваем
 * сериализованное значение — иначе setState в эффекте зациклит рендер.
 */
export function usePublishSnapshot(snapshot: JarvisSnapshot) {
  const { setSnapshot } = useJarvis();
  const serialized = JSON.stringify(snapshot);
  const last = useRef<string>("");

  useEffect(() => {
    if (last.current === serialized) return;
    last.current = serialized;
    setSnapshot(JSON.parse(serialized) as JarvisSnapshot);
  }, [serialized, setSnapshot]);
}
