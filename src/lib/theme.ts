export type ThemeKey = "forge" | "blueprint" | "paper" | "shopfloor" | "terminal";

export interface ThemeSpec {
  key: ThemeKey;
  name: string;
  tagline: string;
  /** кому и где подходит */
  audience: string;
  description: string;
  /** особенности плотности/типографики */
  traits: string[];
  /** цвета для миниатюры-превью */
  swatch: { bg: string; panel: string; accent: string; ink: string; line: string };
}

export const THEMES: Record<ThemeKey, ThemeSpec> = {
  forge: {
    key: "forge",
    name: "Горн",
    tagline: "Индустриальный тёмный",
    audience: "Универсальный · офис и дом",
    description:
      "Базовая тема портала: графит с оранжевым акцентом раскалённого металла. Спокойна для глаз при долгой работе, хорошо показывает 3D и SVG-превью.",
    traits: ["Обычная плотность", "Текст 13px", "Тёмный фон"],
    swatch: {
      bg: "#090a0c",
      panel: "#14161b",
      accent: "#ff5c1a",
      ink: "#ffffff",
      line: "rgba(255,255,255,.09)",
    },
  },
  blueprint: {
    key: "blueprint",
    name: "Синька",
    tagline: "Инженерный чертёж",
    audience: "Конструктор · технолог",
    description:
      "Классическая синька: тёмно-синий фон, голубые линии, частая координатная сетка. Развёртки и линии гибов читаются как на чертеже, глаз не спорит с оранжевым.",
    traits: ["Сетка 26px", "Голубой акцент", "Тёмный фон"],
    swatch: {
      bg: "#071320",
      panel: "#0d2134",
      accent: "#38bdf8",
      ink: "#f0faff",
      line: "rgba(125,211,252,.22)",
    },
  },
  paper: {
    key: "paper",
    name: "Калька",
    tagline: "Светлая, для дневного света",
    audience: "Менеджер · продажи · печать",
    description:
      "Белая бумага и красный карандаш. Единственная светлая тема: читается на солнце и у окна, экономит тонер при печати КП, привычна для работы с документами.",
    traits: ["Светлый фон", "Мягкие тени", "Печать 1:1"],
    swatch: {
      bg: "#efece4",
      panel: "#ffffff",
      accent: "#cf3a1e",
      ink: "#14120f",
      line: "rgba(26,26,26,.18)",
    },
  },
  shopfloor: {
    key: "shopfloor",
    name: "Цех",
    tagline: "Крупно, у станка",
    audience: "Оператор · мастер участка",
    description:
      "Чистый чёрный и янтарный — максимальный контраст при плохом освещении и бликах. Кнопки 52px под работу в перчатках, текст 16px, чтобы читать от станка.",
    traits: ["Кнопки 52px", "Текст 16px", "Макс. контраст"],
    swatch: {
      bg: "#000000",
      panel: "#111111",
      accent: "#ffb000",
      ink: "#fffaf0",
      line: "rgba(255,176,0,.35)",
    },
  },
  terminal: {
    key: "terminal",
    name: "Терминал",
    tagline: "Плотная, для своих",
    audience: "Опытный пользователь · КП на 30 позиций",
    description:
      "Фосфорный зелёный, моноширинный шрифт везде, сжатые отступы. На экран помещается вдвое больше строк таблицы — для тех, кто знает интерфейс наизусть.",
    traits: ["Строки 5px", "Везде моноширинный", "Плотность ×2"],
    swatch: {
      bg: "#04080a",
      panel: "#08131a",
      accent: "#4ade80",
      ink: "#e6ffef",
      line: "rgba(74,222,128,.25)",
    },
  },
};

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];
export const DEFAULT_THEME: ThemeKey = "forge";
export const THEME_STORAGE_KEY = "fireprom-theme";

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === "string" && v in THEMES;
}

/**
 * Скрипт применяет тему до первой отрисовки — иначе на секунду мелькнёт
 * тёмный интерфейс поверх выбранной светлой темы.
 */
/** Привязка темы к модулю портала. Когда пользователь не выбрал
 *  тему вручную — при переходе на /bending включается Синька,
 *  на /kp — Калька, на /machine — Цех, на /ui — Терминал. */
export const THEME_FOR_PATH: ReadonlyArray<readonly [string, ThemeKey]> = [
  ["/bending", "blueprint"],
  ["/cutting", "blueprint"],
  ["/laser", "shopfloor"],
  ["/press", "shopfloor"],
  ["/weld",  "shopfloor"],
  ["/paint", "shopfloor"],
  ["/pack",  "shopfloor"],
  ["/kp", "paper"],
  ["/machine", "shopfloor"],
  ["/ui", "terminal"],
];

export function themeForPath(path: string): ThemeKey {
  for (const [prefix, key] of THEME_FOR_PATH) {
    if (path === prefix || path.startsWith(prefix + "/")) return key;
  }
  return DEFAULT_THEME;
}

export const THEME_INIT_SCRIPT = `(function(){try{
  var k=${JSON.stringify(THEME_KEYS)};
  var d=${JSON.stringify(DEFAULT_THEME)};
  var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if(t==="auto"||k.indexOf(t)===-1){
    var p=window.location.pathname;
    var m=${JSON.stringify(THEME_FOR_PATH)};
    t=d;
    for(var i=0;i<m.length;i++){
      var pre=m[i][0];
      if(p===pre||p.indexOf(pre+"/")===0){t=m[i][1];break;}
    }
  }
  document.documentElement.dataset.theme=t;
}catch(e){document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_THEME)};}})();`;
