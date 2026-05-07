require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Custom Request Logger ───────────────────────────────
// app.use((req, res, next) => {
//   const now = new Date().toLocaleTimeString();
//   console.log(`[${now}] ${req.method} ${req.url}`);
  
//   if (Object.keys(req.body).length > 0) {
//     console.log('Body:', JSON.stringify(req.body, null, 2));
//   }
//   next();
// });

// ─── Routes ──────────────────────────────────────────────
const authRoutes       = require('./routes/auth');
const petRoutes        = require('./routes/pets');
const healthLogRoutes  = require('./routes/healthLogs');
const medicationRoutes = require('./routes/medications');
const foodRoutes       = require('./routes/food');
const routineRoutes    = require('./routes/routines');
const activityRoutes   = require('./routes/activities');
const budgetRoutes     = require('./routes/budget');
const storeRoutes      = require('./routes/stores');
const { quickLog, documents, notifications } = require('./routes/misc');

app.use('/api/auth',           authRoutes);
app.use('/api/pets',           petRoutes);
app.use('/api/health-logs',    healthLogRoutes);
app.use('/api/medications',    medicationRoutes);
app.use('/api/food',           foodRoutes);
app.use('/api/routines',       routineRoutes);
app.use('/api/activities',     activityRoutes);
app.use('/api/budget',         budgetRoutes);
app.use('/api/stores',         storeRoutes);
app.use('/api',                quickLog);
app.use('/api/documents',      documents);
app.use('/api/notifications',  notifications);

// ─── Health check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app: 'PawFind API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'POST   /api/auth/register',
      'POST   /api/auth/login',
      'GET    /api/auth/me',
      'GET    /api/pets',
      'POST   /api/pets',
      'GET    /api/pets/:id/summary',
      'GET    /api/health-logs',
      'POST   /api/health-logs',
      'GET    /api/health-logs/insights',
      'GET    /api/medications',
      'POST   /api/medications',
      'GET    /api/medications/conditions',
      'POST   /api/medications/conditions',
      'GET    /api/medications/vaccinations',
      'POST   /api/medications/vaccinations',
      'GET    /api/food',
      'POST   /api/food/logs',
      'GET    /api/food/logs/summary',
      'GET    /api/routines',
      'POST   /api/routines/:id/complete',
      'GET    /api/routines/:id/streak',
      'GET    /api/activities',
      'GET    /api/activities/stats',
      'GET    /api/budget/insights',
      'POST   /api/budget',
      'GET    /api/stores/search?medicine=&lat=&lng=',
      'GET    /api/stores/nearby?lat=&lng=',
      'POST   /api/stores',
      'PATCH  /api/stores/:id/inventory/:itemId',
      'POST   /api/quick-log',
      'GET    /api/notifications',
      'POST   /api/documents'
    ]
  });
});

// ─── 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ███████╗███╗   ██╗██╗   ██╗███████╗███████╗██╗     ███████╗
  ██╔════╝████╗  ██║██║   ██║██╔════╝██╔════╝██║     ██╔════╝
  ███████╗██╔██╗ ██║██║   ██║█████╗  █████╗  ██║     █████╗  
  ╚════██║██║╚██╗██║██║   ██║██╔══╝  ██╔══╝  ██║     ██╔══╝  
  ███████║██║ ╚████║╚██████╔╝██║     ██║     ███████╗███████╗
  ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝     ╚══════╝╚══════╝
  
  API running on http://localhost:${PORT}
  `);
});

module.exports = app;
