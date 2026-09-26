"use client";

import { Check, Eye, Users } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { ThemePreview } from "@/components/theme-preview";
import { THEMES, THEME_KEYS } from "@/lib/theme";
import { clsx } from "@/lib/format";

export function ThemeGallery() {
  const { theme, setTheme, ready } = useTheme();

  return (
    <div className="space-y-8">
      {/* заголовок */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro">Оформление · 5 вариантов</p>
          <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            Интерфейс <span className="text-accent">под задачу</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel">
            Темы меняют не только цвет: вместе с палитрой подстраиваются размер
            шрифта, высота кнопок и плотность таблиц. У менеджера в офисе, технолога
            за столом и оператора у станка — разные условия работы.
          </p>
        </div>
        {ready && (
          <span className="chip border-ok/50! text-ok!">
            <Check size={11} /> сейчас: {THEMES[theme].name}
          </span>
        )}
      </div>

      {/* сетка вариантов */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {THEME_KEYS.map((k) => {
          const t = THEMES[k];
          const active = ready && k === theme;
          return (
            <div
              key={k}
              className={clsx(
                "panel flex flex-col transition-colors",
                active ? "border-accent/60" : "hover:border-accent/30"
              )}
            >
              {/* живое превью в собственной теме */}
              <div className="border-b border-line">
                <ThemePreview theme={k} />
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{t.name}</h2>
                    <p className="micro mt-1">{t.tagline}</p>
                  </div>
                  <div className="flex gap-1">
                    {[t.swatch.bg, t.swatch.panel, t.swatch.accent, t.swatch.ink].map((c, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 border border-line"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                <p className="mt-3 flex items-center gap-2 text-[12px] text-amber">
                  <Users size={12} className="shrink-0" />
                  {t.audience}
                </p>

                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-steel">
                  {t.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {t.traits.map((tr) => (
                    <span key={tr} className="chip">
                      {tr}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setTheme(k)}
                  disabled={active}
                  className={clsx("btn mt-5 w-full", active ? "btn-outline" : "btn-primary")}
                >
                  {active ? (
                    <>
                      <Check size={13} /> Применена
                    </>
                  ) : (
                    <>
                      <Eye size={13} /> Применить
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* пояснение вместо шестой карточки */}
        <div className="panel panel-pad flex flex-col justify-center">
          <p className="micro">Как это устроено</p>
          <p className="mt-3 text-[13px] leading-relaxed text-steel">
            Вся палитра и плотность вынесены в CSS-переменные на{" "}
            <span className="num text-ghost">&lt;html data-theme&gt;</span>. Компоненты
            цветов не знают — поэтому новая тема добавляется одним блоком в{" "}
            <span className="num text-ghost">globals.css</span>, без правок разметки.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-steel">
            Выбор хранится в localStorage и применяется инлайн-скриптом до первой
            отрисовки — светлая тема не мигает тёмным при загрузке.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-steel">
            Печать КП всегда идёт в чёрно-белом виде независимо от темы.
          </p>
        </div>
      </div>

      {/* сравнительная таблица */}
      <div className="panel panel-pad overflow-x-auto">
        <p className="micro mb-4">Что именно меняется</p>
        <table className="tbl min-w-[720px]">
          <thead>
            <tr>
              <th>Параметр</th>
              {THEME_KEYS.map((k) => (
                <th key={k} className={k === theme ? "text-accent!" : undefined}>
                  {THEMES[k].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Основной текст", ["13px", "13px", "13px", "16px", "12px"]],
              ["Высота полей", ["36px", "36px", "36px", "52px", "30px"]],
              ["Отступ панели", ["20px", "20px", "20px", "24px", "13px"]],
              ["Строка таблицы", ["9px", "9px", "9px", "15px", "5px"]],
              ["Шаг сетки фона", ["44px", "26px", "24px", "44px", "20px"]],
              ["Схема", ["тёмная", "тёмная", "светлая", "тёмная", "тёмная"]],
            ].map(([label, values]) => (
              <tr key={label as string}>
                <td className="text-steel">{label as string}</td>
                {(values as string[]).map((v, i) => (
                  <td
                    key={i}
                    className={clsx("num", THEME_KEYS[i] === theme && "text-accent")}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[11px] leading-relaxed text-steel">
          Тема применяется ко всему порталу сразу: расчёт гибки, конструктор КП,
          история и Jarvis. Переключить можно в любой момент из шапки — иконка палитры.
        </p>
      </div>
    </div>
  );
}
