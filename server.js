// server.js — Express API Entry Point
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:5501', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── STATIC FILES (serve the frontend too) ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'modern_ui')));

// ─── API ROUTES ──────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/buses',    require('./routes/buses'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/reviews',  require('./routes/reviews'));

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '🚌 BusTicket API is running!', timestamp: new Date().toISOString() });
});

// ─── START SERVER ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚌 BusTicket API Server started!`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health\n`);
});
