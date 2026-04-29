-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260428000001_categories_20_canonical
-- Purpose:   Add slug_es + name_es columns to categories table.
--            Replace 10-row seed with 20 canonical categories that match the
--            expanded classifyCategory() ruleset in enrichment-agent.
--            Safe: categories has no FK references anywhere in the schema.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add new columns (idempotent)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS slug_es    text,
  ADD COLUMN IF NOT EXISTS name_es    text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_es text;

-- Step 2: Destroy old 10-row seed (no FKs — safe)
DELETE FROM categories;

-- Step 3: Insert 20 canonical categories
-- slug values are the source of truth — must match category_slug in businesses table
-- and FALLBACK_SLUGS in sitemap-categories/route.ts
INSERT INTO categories (id, name, slug, slug_es, name_es, description_en, description_es, business_count) VALUES
  (gen_random_uuid(), 'Legal Services',          'legal-services',        'servicios-legales',        'Servicios Legales',           'Browse Florida-registered law firms, attorneys, and legal service providers.',              'Explore firmas de abogados y servicios legales registrados en Florida.',               0),
  (gen_random_uuid(), 'Healthcare',              'healthcare',            'salud',                    'Salud',                       'Find medical clinics, dental offices, therapy practices, and healthcare providers in Florida.','Encuentra clínicas médicas, consultorios dentales y proveedores de salud en Florida.',  0),
  (gen_random_uuid(), 'Insurance',               'insurance',             'seguros',                  'Seguros',                     'Search insurance agencies, underwriters, and brokers registered in Florida.',               'Busca agencias de seguros y corredores registrados en Florida.',                       0),
  (gen_random_uuid(), 'Real Estate',             'real-estate',           'bienes-raices',            'Bienes Raíces',               'Find realtors, property managers, mortgage companies, and title firms in Florida.',        'Encuentra agentes inmobiliarios, administradores de propiedades y notarías en Florida.',0),
  (gen_random_uuid(), 'Construction',            'construction',          'construccion',             'Construcción',                'Browse Florida-registered contractors, builders, roofers, and construction companies.',     'Explora contratistas, constructores y empresas de construcción registradas en Florida.',0),
  (gen_random_uuid(), 'Landscaping',             'landscaping',           'jardineria',               'Jardinería',                  'Find lawn care, irrigation, tree service, and landscaping companies across Florida.',       'Encuentra empresas de jardinería, poda de árboles y mantenimiento de jardines en Florida.',0),
  (gen_random_uuid(), 'Home Services',           'home-services',         'servicios-del-hogar',      'Servicios del Hogar',         'Search handymen, pool service, pest control, and home repair businesses in Florida.',      'Busca servicios de mantenimiento del hogar, control de plagas y reparaciones en Florida.',0),
  (gen_random_uuid(), 'Automotive',              'automotive',            'automotriz',               'Automotriz',                  'Browse auto repair shops, car dealerships, towing services, and detail shops in Florida.', 'Encuentra talleres mecánicos, concesionarios de autos y servicios de remolque en Florida.',0),
  (gen_random_uuid(), 'Transportation',          'transportation',        'transporte',               'Transporte',                  'Find trucking, logistics, freight, moving, and courier companies registered in Florida.',   'Encuentra empresas de transporte, logística, mudanzas y mensajería en Florida.',       0),
  (gen_random_uuid(), 'Food & Beverage',         'food-beverage',         'alimentos-y-bebidas',      'Alimentos y Bebidas',         'Browse Florida restaurants, cafes, catering companies, bakeries, and food businesses.',    'Explora restaurantes, cafeterías, empresas de catering y panaderías en Florida.',      0),
  (gen_random_uuid(), 'Cleaning Services',       'cleaning-services',     'servicios-de-limpieza',    'Servicios de Limpieza',       'Find cleaning companies, janitorial services, and pressure washing businesses in Florida.', 'Encuentra empresas de limpieza, servicios de conserjería y lavado a presión en Florida.',0),
  (gen_random_uuid(), 'Beauty & Wellness',       'beauty-wellness',       'belleza-y-bienestar',      'Belleza y Bienestar',         'Search salons, spas, barbershops, nail salons, and wellness businesses in Florida.',       'Busca salones, spas, barberías y negocios de bienestar registrados en Florida.',       0),
  (gen_random_uuid(), 'Technology',              'technology',            'tecnologia',               'Tecnología',                  'Browse software companies, IT service providers, and tech businesses in Florida.',         'Explora empresas de software, servicios de TI y negocios de tecnología en Florida.',   0),
  (gen_random_uuid(), 'Marketing & Advertising', 'marketing-advertising', 'marketing-y-publicidad',   'Marketing y Publicidad',      'Find marketing agencies, advertising firms, and branding companies registered in Florida.', 'Encuentra agencias de marketing, publicidad y branding registradas en Florida.',       0),
  (gen_random_uuid(), 'Accounting & Finance',    'accounting-finance',    'contabilidad-y-finanzas',  'Contabilidad y Finanzas',     'Search accounting firms, bookkeepers, tax preparers, and financial advisors in Florida.', 'Busca contadores, preparadores de impuestos y asesores financieros en Florida.',       0),
  (gen_random_uuid(), 'Education',               'education',             'educacion',                'Educación',                   'Find schools, tutoring centers, childcare providers, and academies in Florida.',           'Encuentra escuelas, centros de tutoría, guarderías y academias en Florida.',           0),
  (gen_random_uuid(), 'Retail',                  'retail',                'comercio-minorista',       'Comercio Minorista',          'Browse clothing boutiques, gift shops, wholesale distributors, and retail stores in Florida.','Explora boutiques, tiendas de regalos y distribuidores mayoristas en Florida.',       0),
  (gen_random_uuid(), 'Professional Services',   'professional-services', 'servicios-profesionales',  'Servicios Profesionales',     'Find consulting, staffing, engineering, and professional service firms in Florida.',      'Encuentra consultoras, empresas de reclutamiento e ingeniería en Florida.',            0),
  (gen_random_uuid(), 'Non-Profit & Religious',  'nonprofit-religious',   'sin-fines-de-lucro',       'Sin Fines de Lucro',          'Browse churches, foundations, charities, and non-profit organizations in Florida.',       'Explora iglesias, fundaciones, organizaciones benéficas y sin fines de lucro en Florida.',0),
  (gen_random_uuid(), 'General Business',        'general-business',      'negocios-en-general',      'Negocios en General',         'Browse Florida businesses across all industries not classified in a specific category.',  'Explora negocios de Florida en industrias diversas no clasificadas específicamente.',   0);

-- Step 4: Unique index on slug (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug    ON categories(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_es ON categories(slug_es);
