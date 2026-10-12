-- FireProM v14 — сид каталога дверей (PR-5a)
-- Идемпотентно: повторный запуск не создаёт дубликатов

-- 1. Профили короба/полотна
INSERT INTO catalog_items (type, key, name, unit) VALUES
  ('door_profile', 'standard-60',   'Профиль Стандарт 60',   'м'),
  ('door_profile', 'reinforced-80', 'Профиль Усиленный 80',  'м'),
  ('door_profile', 'premium-100',   'Профиль Премиум 100',   'м')
ON CONFLICT (type, key) DO NOTHING;

INSERT INTO door_profiles
  (catalog_item_id, profile_type, steel_thickness, min_door_width, max_door_width, min_door_height, max_door_height, color, coating, thermal_break, u_value, weight_per_meter)
SELECT id, 'standard', 1.20, 600, 1000, 1900, 2100, 'серый', 'powder', false, 2.50, 12.000
  FROM catalog_items WHERE type='door_profile' AND key='standard-60'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_profiles
  (catalog_item_id, profile_type, steel_thickness, min_door_width, max_door_width, min_door_height, max_door_height, color, coating, thermal_break, u_value, weight_per_meter)
SELECT id, 'reinforced', 1.50, 600, 1100, 1900, 2200, 'серый', 'powder', true, 1.80, 18.000
  FROM catalog_items WHERE type='door_profile' AND key='reinforced-80'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_profiles
  (catalog_item_id, profile_type, steel_thickness, min_door_width, max_door_width, min_door_height, max_door_height, color, coating, thermal_break, u_value, weight_per_meter)
SELECT id, 'premium', 2.00, 700, 1200, 2000, 2400, 'любой RAL', 'polymer', true, 1.20, 25.000
  FROM catalog_items WHERE type='door_profile' AND key='premium-100'
ON CONFLICT (catalog_item_id) DO NOTHING;

-- 2. Наполнения
INSERT INTO catalog_items (type, key, name, unit) VALUES
  ('door_filling', 'minwool-50',  'Минвата 50мм',         'м²'),
  ('door_filling', 'pps-40',      'Пенополистирол 40мм',  'м²'),
  ('door_filling', 'combined-60', 'Комбинированный 60мм', 'м²')
ON CONFLICT (type, key) DO NOTHING;

INSERT INTO door_fillings
  (catalog_item_id, filling_type, thickness_mm, thermal_resistance, density_kg_m3, fire_rating, sound_insulation_db)
SELECT id, 'mineral_wool', 50, 1.10, 100, 'EI60', 32
  FROM catalog_items WHERE type='door_filling' AND key='minwool-50'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_fillings
  (catalog_item_id, filling_type, thickness_mm, thermal_resistance, density_kg_m3, fire_rating, sound_insulation_db)
SELECT id, 'polystyrene', 40, 0.80, 25, NULL, 24
  FROM catalog_items WHERE type='door_filling' AND key='pps-40'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_fillings
  (catalog_item_id, filling_type, thickness_mm, thermal_resistance, density_kg_m3, fire_rating, sound_insulation_db)
SELECT id, 'combined', 60, 1.30, 80, 'EI60', 36
  FROM catalog_items WHERE type='door_filling' AND key='combined-60'
ON CONFLICT (catalog_item_id) DO NOTHING;

-- 3. Отделки
INSERT INTO catalog_items (type, key, name, unit) VALUES
  ('door_finish', 'powder-ral7016', 'Порошок RAL 7016', 'м²'),
  ('door_finish', 'mdf-ven ge',     'МДФ Венге',        'м²'),
  ('door_finish', 'mirror',         'Зеркало',          'м²')
ON CONFLICT (type, key) DO NOTHING;

INSERT INTO door_finishes
  (catalog_item_id, finish_type, side, ral_code, texture, thickness_mm)
SELECT id, 'powder_paint', 'external', 'RAL7016', 'матовый', NULL
  FROM catalog_items WHERE type='door_finish' AND key='powder-ral7016'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_finishes
  (catalog_item_id, finish_type, side, ral_code, texture, thickness_mm)
SELECT id, 'mdf_panel', 'internal', NULL, 'венге', 8.00
  FROM catalog_items WHERE type='door_finish' AND key='mdf-ven ge'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_finishes
  (catalog_item_id, finish_type, side, ral_code, texture, thickness_mm)
SELECT id, 'mirror', 'internal', NULL, 'глянец', 4.00
  FROM catalog_items WHERE type='door_finish' AND key='mirror'
ON CONFLICT (catalog_item_id) DO NOTHING;

-- 4. Фурнитура
INSERT INTO catalog_items (type, key, name, unit) VALUES
  ('door_hardware', 'lock-kale-252',  'Замок Kale 252',  'шт'),
  ('door_hardware', 'lock-gardian-4', 'Замок Gardian (4 класс)', 'шт'),
  ('door_hardware', 'hinge-bark-3d',  'Петля Барк 3D',   'шт'),
  ('door_hardware', 'handle-apecs',   'Ручка Apecs',     'шт')
ON CONFLICT (type, key) DO NOTHING;

INSERT INTO door_hardware
  (catalog_item_id, hardware_type, security_class, max_weight_kg, material, finish)
SELECT id, 'lock', 3, NULL, 'сталь', 'хром'
  FROM catalog_items WHERE type='door_hardware' AND key='lock-kale-252'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_hardware
  (catalog_item_id, hardware_type, security_class, max_weight_kg, material, finish)
SELECT id, 'lock', 4, NULL, 'сталь', 'никель'
  FROM catalog_items WHERE type='door_hardware' AND key='lock-gardian-4'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_hardware
  (catalog_item_id, hardware_type, security_class, max_weight_kg, material, finish)
SELECT id, 'hinge', NULL, 80, 'сталь', 'цинк'
  FROM catalog_items WHERE type='door_hardware' AND key='hinge-bark-3d'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_hardware
  (catalog_item_id, hardware_type, security_class, max_weight_kg, material, finish)
SELECT id, 'handle', NULL, NULL, 'латунь', 'хром'
  FROM catalog_items WHERE type='door_hardware' AND key='handle-apecs'
ON CONFLICT (catalog_item_id) DO NOTHING;

-- 5. Услуги
INSERT INTO catalog_items (type, key, name, unit) VALUES
  ('door_service', 'measurement',  'Замер',     'шт'),
  ('door_service', 'delivery',     'Доставка',  'шт'),
  ('door_service', 'installation', 'Монтаж',    'шт'),
  ('door_service', 'dismantling',  'Демонтаж',  'шт'),
  ('door_service', 'warranty',     'Гарантия',  'шт')
ON CONFLICT (type, key) DO NOTHING;

INSERT INTO door_services (catalog_item_id, service_type, is_free, formula)
SELECT id, 'measurement', true, '{}'::jsonb
  FROM catalog_items WHERE type='door_service' AND key='measurement'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_services (catalog_item_id, service_type, is_free, formula)
SELECT id, 'delivery', false, '{"type":"fixed","price":2500}'::jsonb
  FROM catalog_items WHERE type='door_service' AND key='delivery'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_services (catalog_item_id, service_type, is_free, formula)
SELECT id, 'installation', false, '{"type":"fixed","price":5000}'::jsonb
  FROM catalog_items WHERE type='door_service' AND key='installation'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_services (catalog_item_id, service_type, is_free, formula)
SELECT id, 'dismantling', false, '{"type":"fixed","price":3000}'::jsonb
  FROM catalog_items WHERE type='door_service' AND key='dismantling'
ON CONFLICT (catalog_item_id) DO NOTHING;

INSERT INTO door_services (catalog_item_id, service_type, is_free, formula)
SELECT id, 'warranty', true, '{}'::jsonb
  FROM catalog_items WHERE type='door_service' AND key='warranty'
ON CONFLICT (catalog_item_id) DO NOTHING;
