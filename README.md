# 🐾 PawFind Backend API

A complete REST API for the PawFind pet health app — built with **Node.js + Express + Supabase**.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in your Supabase URL and service key
```

### 3. Set up Supabase database
- Go to your Supabase project → SQL Editor
- Copy and run the entire contents of `supabase/schema.sql`
- Create a storage bucket named `pawfind-documents` in Supabase Storage

### 4. Run the server
```bash
npm run dev    # development with auto-reload
npm start      # production
```

Server runs at: `http://localhost:3000`

---

## 🔐 Authentication

All protected endpoints require a Bearer token in the header:
```
Authorization: Bearer <your_jwt_token>
```

Get a token by calling `/api/auth/login` or `/api/auth/register`.

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get token |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update profile |

### Pets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pets` | List all your pets |
| POST | `/api/pets` | Add a new pet |
| GET | `/api/pets/:id` | Get pet details |
| PATCH | `/api/pets/:id` | Update pet |
| DELETE | `/api/pets/:id` | Remove pet |
| GET | `/api/pets/:id/summary` | Dashboard summary |

### Quick Log (one-tap)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/quick-log` | Log pee/poo/feed/walk/vomit instantly |
| GET | `/api/quick-log?pet_id=&date=` | Today's quick logs |

**Body:** `{ "pet_id": "uuid", "log_type": "pee" | "poo" | "feed" | "walk" | "vomit" }`

### Health Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health-logs?pet_id=&type=` | Get logs with filters |
| POST | `/api/health-logs` | Log health event |
| DELETE | `/api/health-logs/:id` | Remove log |
| GET | `/api/health-logs/insights?pet_id=&period=7` | Weekly insights |

**log_type options:** `pee, poo, vomit, injury, symptom, vet_visit, weight, other`

### Medications & Vaccinations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/medications?pet_id=&active=true` | Get medications |
| POST | `/api/medications` | Add medication |
| PATCH | `/api/medications/:id` | Update medication |
| DELETE | `/api/medications/:id` | Remove medication |
| GET | `/api/medications/vaccinations?pet_id=` | Get vaccinations |
| POST | `/api/medications/vaccinations` | Add vaccination |
| GET | `/api/medications/conditions?pet_id=` | Get conditions |
| POST | `/api/medications/conditions` | Add condition |

### Food & Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/food` | List food items |
| POST | `/api/food` | Add food item |
| PATCH | `/api/food/:id` | Update food (stock) |
| GET | `/api/food/logs?pet_id=` | Feeding history |
| POST | `/api/food/logs` | Log a feeding (auto-deducts stock) |
| GET | `/api/food/logs/summary?pet_id=&period=7` | Calorie/cost summary |

### Routines & Streaks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routines?pet_id=` | List routines |
| POST | `/api/routines` | Create routine |
| PATCH | `/api/routines/:id` | Update routine |
| DELETE | `/api/routines/:id` | Remove routine |
| POST | `/api/routines/:id/complete` | Mark done today |
| GET | `/api/routines/:id/streak?period=30` | Streak + consistency chart |

**Streak response includes:** `current_streak`, `consistency_pct`, `chart[]` (day-by-day for 7/14/30 days)

### Walks & Activity
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities?pet_id=&type=walk` | Activity history |
| POST | `/api/activities` | Log/start session |
| PATCH | `/api/activities/:id` | End session / save GPS route |
| GET | `/api/activities/stats?pet_id=&period=7` | Stats summary |

**GPS route:** Send as `route_geojson` (GeoJSON LineString format)

### Budget
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budget?pet_id=` | List expenses |
| POST | `/api/budget` | Add expense |
| PATCH | `/api/budget/:id` | Update expense |
| DELETE | `/api/budget/:id` | Remove expense |
| GET | `/api/budget/insights?pet_id=&year=&month=` | Monthly breakdown by category |

**Categories:** `food, vet, medication, grooming, accessories, other`

### Medical Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents?pet_id=` | List documents |
| POST | `/api/documents` | Upload file (multipart/form-data) |
| DELETE | `/api/documents/:id` | Remove document |

**Upload:** Send as `multipart/form-data` with field `file` + `pet_id`, `title`, `document_type`

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get all notifications |
| POST | `/api/notifications` | Create notification |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |

---

## 🗺️ Medicine Store API (The PawFind Unique Feature)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/stores/search?medicine=&lat=&lng=&radius_km=` | **Find stores with medicine near you** | No |
| GET | `/api/stores/nearby?lat=&lng=&radius_km=` | All stores on map | No |
| GET | `/api/stores/:id` | Store details + full inventory | No |
| POST | `/api/stores` | Register your store | Yes |
| PATCH | `/api/stores/:id` | Update store info | Yes |
| GET | `/api/stores/:id/inventory` | Manage inventory | Yes |
| POST | `/api/stores/:id/inventory` | Add medicine to store | Yes |
| PATCH | `/api/stores/:id/inventory/:itemId` | Update stock/price | Yes |
| DELETE | `/api/stores/:id/inventory/:itemId` | Remove medicine | Yes |

### Medicine Search Example
```
GET /api/stores/search?medicine=Apoquel&lat=11.8745&lng=75.3704&radius_km=10

Response:
{
  "medicine": "Apoquel",
  "results_count": 3,
  "results": [
    {
      "store": { "name": "City Pet Pharmacy", "lat": 11.87, "lng": 75.37, "phone": "..." },
      "medicine_name": "Apoquel 16mg",
      "price": 450,
      "in_stock": true,
      "distance_km": 1.2
    }
  ]
}
```

---

## 🏗️ Tech Stack
- **Runtime:** Node.js
- **Framework:** Express
- **Database:** Supabase (PostgreSQL)
- **Auth:** JWT (jsonwebtoken)
- **File Upload:** Multer → Supabase Storage
- **Password:** bcryptjs

## 🌐 Web App Ready?
Yes — this is a pure REST API. Any web framework (React, Vue, Next.js) can call these same endpoints. Just use the same JWT token in the Authorization header.

## 📦 Deploy to Railway (free)
1. Push this folder to GitHub
2. Go to railway.app → New Project → GitHub repo
3. Add environment variables from `.env.example`
4. Deploy — Railway auto-detects Node.js
