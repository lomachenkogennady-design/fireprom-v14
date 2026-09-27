# Модуль: Гибка (bending-calculator)

## Назначение
Расчёт развёртки листового металла по DIN 6935. Экспорт DXF для лазера и гибочного станка.

## Формулы
- `BA = θ · (R + K·T)` — Bend Allowance
- `OSSB = (R+T) · tan(θ/2)` — Outside Setback
- `BD = 2·OSSB − BA` — Bend Deduction
- `L_разв = Σ полок − n·BD`
- K-фактор — таблица DIN 6935 по R/T (0.28…0.5)

## Ключевые файлы
- `src/lib/geometry.ts` — формулы
- `src/lib/materials.ts` — материалы (Ст3, AISI 304, АМг2)
- `src/lib/dxf.ts` — экспорт DXF (слои CUT/BEND/HOLES/TEXT)
- `src/components/bending-calculator.tsx` — форма
- `src/components/part-preview.tsx` — 2D SVG
- `src/components/part-3d.tsx` — 3D Three.js

## Результаты
Развёртка, K-фактор, R, V-матрица, мин. полка, вес, усилие.
