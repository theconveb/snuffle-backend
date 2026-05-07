-- ═══════════════════════════════════════════════════════
--  PawFind — Supabase Schema
--  Run this entire file in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "postgis"; -- for location/map features

-- ───────────────────────────────────────────
-- USERS
-- ───────────────────────────────────────────
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  full_name text,
  phone text,
  avatar_url text,
  notification_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- PETS
-- ───────────────────────────────────────────
create table if not exists pets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  species text not null,         -- dog, cat, rabbit, bird, etc.
  breed text,
  date_of_birth date,
  gender text,                   -- male, female
  weight_kg numeric(5,2),
  color text,
  microchip_id text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- HEALTH CONDITIONS
-- ───────────────────────────────────────────
create table if not exists health_conditions (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  name text not null,            -- e.g. "Diabetes", "Hip Dysplasia"
  type text,                     -- allergy, chronic, injury, other
  diagnosed_date date,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- MEDICATIONS
-- ───────────────────────────────────────────
create table if not exists medications (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  condition_id uuid references health_conditions(id) on delete set null,
  name text not null,
  dosage text,
  frequency text,                -- once_daily, twice_daily, weekly, etc.
  start_date date,
  end_date date,
  refill_date date,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- VACCINATIONS
-- ───────────────────────────────────────────
create table if not exists vaccinations (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  name text not null,            -- Rabies, Parvovirus, etc.
  administered_date date,
  next_due_date date,
  vet_name text,
  clinic_name text,
  batch_number text,
  notes text,
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- HEALTH LOGS
-- ───────────────────────────────────────────
create table if not exists health_logs (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  log_type text not null,        -- pee, poo, vomit, injury, symptom, vet_visit, weight, other
  severity text,                 -- normal, mild, moderate, severe
  notes text,
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- FOOD & INVENTORY
-- ───────────────────────────────────────────
create table if not exists food_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  brand text,
  calories_per_100g numeric(7,2),
  cost_per_unit numeric(8,2),
  unit text,                     -- kg, g, cups, cans
  current_stock numeric(8,2),
  low_stock_threshold numeric(8,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists feeding_logs (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  food_item_id uuid references food_items(id) on delete set null,
  quantity numeric(7,2),
  unit text,
  calories numeric(7,2),
  cost numeric(7,2),
  notes text,
  fed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- WALKS & PLAY SESSIONS
-- ───────────────────────────────────────────
create table if not exists activity_sessions (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  session_type text not null,    -- walk, play, run, swim
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  distance_km numeric(8,3),
  route_geojson jsonb,           -- GPS route stored as GeoJSON
  calories_burned numeric(7,2),
  notes text,
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- ROUTINES & STREAKS
-- ───────────────────────────────────────────
create table if not exists routines (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  name text not null,
  routine_type text,             -- feeding, walk, medication, grooming, play, custom
  frequency text,                -- daily, weekly, custom
  scheduled_time time,
  scheduled_days jsonb,          -- ["mon","tue","wed"] for weekly
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists routine_completions (
  id uuid primary key default uuid_generate_v4(),
  routine_id uuid references routines(id) on delete cascade,
  pet_id uuid references pets(id) on delete cascade,
  completed_at timestamptz default now(),
  notes text
);

-- ───────────────────────────────────────────
-- MEDICAL DOCUMENTS
-- ───────────────────────────────────────────
create table if not exists medical_documents (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  title text not null,
  document_type text,            -- vaccination_card, lab_report, prescription, xray, other
  file_url text,
  file_type text,                -- pdf, jpg, png
  file_size_bytes integer,
  notes text,
  document_date date,
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- BUDGET / EXPENSES
-- ───────────────────────────────────────────
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  category text not null,        -- food, vet, medication, grooming, accessories, other
  amount numeric(10,2) not null,
  description text,
  expense_date date default current_date,
  receipt_url text,
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- QUICK LOG (one-tap from dashboard)
-- ───────────────────────────────────────────
create table if not exists quick_logs (
  id uuid primary key default uuid_generate_v4(),
  pet_id uuid references pets(id) on delete cascade,
  log_type text not null,        -- pee, poo, feed, walk, vomit
  logged_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- MEDICINE STORES (the PawFind unique feature)
-- ───────────────────────────────────────────
create table if not exists medicine_stores (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references users(id) on delete set null,
  name text not null,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  lat numeric(10,7),
  lng numeric(10,7),
  opening_time time,
  closing_time time,
  open_days jsonb,               -- ["mon","tue","wed","thu","fri","sat"]
  is_verified boolean default false,
  is_active boolean default true,
  listing_plan text default 'free', -- free, basic, premium
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists store_inventory (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid references medicine_stores(id) on delete cascade,
  medicine_name text not null,
  brand text,
  category text,                 -- antibiotic, antiparasitic, vaccine, supplement, other
  for_species jsonb,             -- ["dog","cat","rabbit"]
  price numeric(8,2),
  in_stock boolean default true,
  stock_quantity integer,
  updated_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- NOTIFICATIONS
-- ───────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  pet_id uuid references pets(id) on delete set null,
  title text not null,
  body text,
  type text,                     -- medication, vaccination, routine, refill, walk, custom
  is_read boolean default false,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- ───────────────────────────────────────────
-- INDEXES for performance
-- ───────────────────────────────────────────
create index if not exists idx_pets_user_id on pets(user_id);
create index if not exists idx_health_logs_pet_id on health_logs(pet_id);
create index if not exists idx_health_logs_logged_at on health_logs(logged_at);
create index if not exists idx_feeding_logs_pet_id on feeding_logs(pet_id);
create index if not exists idx_activity_sessions_pet_id on activity_sessions(pet_id);
create index if not exists idx_routine_completions_routine_id on routine_completions(routine_id);
create index if not exists idx_store_inventory_store_id on store_inventory(store_id);
create index if not exists idx_store_inventory_medicine_name on store_inventory(medicine_name);
create index if not exists idx_medicine_stores_city on medicine_stores(city);
create index if not exists idx_expenses_pet_id on expenses(pet_id);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_quick_logs_pet_id on quick_logs(pet_id);

-- ───────────────────────────────────────────
-- ROW LEVEL SECURITY (basic)
-- ───────────────────────────────────────────
alter table users enable row level security;
alter table pets enable row level security;
alter table health_logs enable row level security;
alter table feeding_logs enable row level security;
alter table activity_sessions enable row level security;
alter table routines enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;
