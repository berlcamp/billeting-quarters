-- Seed: 17 Philippine regions as delegations.
-- Idempotent — safe to re-run. Run after 01-database-schema-v3.sql is applied.

INSERT INTO palaro.delegations (region_code, region_name, short_name) VALUES
  ('NCR',    'National Capital Region',                            'NCR'),
  ('CAR',    'Cordillera Administrative Region',                   'CAR'),
  ('R-I',    'Region I — Ilocos Region',                           'Ilocos'),
  ('R-II',   'Region II — Cagayan Valley',                         'Cagayan Valley'),
  ('R-III',  'Region III — Central Luzon',                         'Central Luzon'),
  ('R-IV-A', 'Region IV-A — CALABARZON',                           'CALABARZON'),
  ('R-IV-B', 'Region IV-B — MIMAROPA',                             'MIMAROPA'),
  ('R-V',    'Region V — Bicol Region',                            'Bicol'),
  ('R-VI',   'Region VI — Western Visayas',                        'Western Visayas'),
  ('R-VII',  'Region VII — Central Visayas',                       'Central Visayas'),
  ('R-VIII', 'Region VIII — Eastern Visayas',                      'Eastern Visayas'),
  ('R-IX',   'Region IX — Zamboanga Peninsula',                    'Zamboanga'),
  ('R-X',    'Region X — Northern Mindanao',                       'Northern Mindanao'),
  ('R-XI',   'Region XI — Davao Region',                           'Davao'),
  ('R-XII',  'Region XII — SOCCSKSARGEN',                          'SOCCSKSARGEN'),
  ('R-XIII', 'Region XIII — Caraga',                               'Caraga'),
  ('BARMM',  'Bangsamoro Autonomous Region in Muslim Mindanao',    'BARMM')
ON CONFLICT (region_code) DO NOTHING;
