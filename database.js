// database.js — SQLite Database Initialization (using sqlite3 async API)
const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');
const path    = require('path');

const DB_PATH = path.join(__dirname, 'busticket.db');
const db      = new sqlite3.Database(DB_PATH, (err) => {
    if (err) { console.error('❌ DB connection error:', err.message); }
    else      { console.log('✅ Connected to SQLite database.'); }
});

// ─── PROMISE HELPERS ─────────────────────────────────────────────────────────
db.asyncAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});
db.asyncRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
});
db.asyncGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});

// ─── SHARED LOGIC: AUTO-RECYCLE SEATS ────────────────────────────────────────
// Marks past trips as 'completed' to free up seats for future runs
db.autoRecycleSeats = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        // Mark all active bookings for past buses as 'completed'
        await db.asyncRun(`
            UPDATE bookings 
            SET status = 'completed' 
            WHERE status IN ('confirmed', 'pending') 
            AND bus_id IN (SELECT id FROM buses WHERE date < ?)`, 
        [today]);
    } catch (err) { console.error('Auto-recycle seats failed:', err); }
};

// ─── CREATE TABLES ───────────────────────────────────────────────────────────
db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL;');

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name    TEXT NOT NULL,
        last_name     TEXT DEFAULT '',
        email         TEXT UNIQUE NOT NULL,
        username      TEXT UNIQUE,
        password      TEXT,
        google_id     TEXT,
        avatar        TEXT,
        role          TEXT DEFAULT 'user',
        reset_token   TEXT,
        reset_expires TEXT,
        phone         TEXT,
        address       TEXT,
        emergency_contact TEXT,
        wallet_balance REAL DEFAULT 0,
        created_at    TEXT DEFAULT (datetime('now'))
    )`);

    // --- Migration: Add new columns if they don't exist ---
    const addCols = [
        "ALTER TABLE users ADD COLUMN phone TEXT",
        "ALTER TABLE users ADD COLUMN address TEXT",
        "ALTER TABLE users ADD COLUMN emergency_contact TEXT",
        "ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0"
    ];
    addCols.forEach(sql => db.run(sql, (err) => { /* ignore if already exists */ }));

    db.run(`CREATE TABLE IF NOT EXISTS buses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,
        from_city   TEXT NOT NULL,
        to_city     TEXT NOT NULL,
        date        TEXT NOT NULL,
        departure   TEXT NOT NULL,
        arrival     TEXT NOT NULL,
        duration    TEXT DEFAULT 'N/A',
        price       REAL NOT NULL,
        seats       INTEGER DEFAULT 30,
        rating      REAL DEFAULT 4.5,
        operator_id INTEGER,
        created_at  TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (operator_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER,
        bus_id       INTEGER NOT NULL,
        passenger    TEXT NOT NULL,
        seats        TEXT NOT NULL,
        total_amount REAL NOT NULL,
        booking_ref  TEXT UNIQUE NOT NULL,
        status       TEXT DEFAULT 'confirmed',
        booked_at    TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (bus_id) REFERENCES buses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        bus_id     INTEGER NOT NULL,
        rating     INTEGER NOT NULL,
        comment    TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (bus_id) REFERENCES buses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        code                TEXT UNIQUE NOT NULL,
        discount_percentage REAL NOT NULL,
        expiration_date     TEXT,
        is_active           INTEGER DEFAULT 1
    )`);

    // ─── SEED DEFAULT ADMIN ACCOUNT ──────────────────────────────────────────
    db.get("SELECT id FROM users WHERE username='admin'", [], (err, row) => {
        if (!err && !row) {
            const hashed = bcrypt.hashSync('admin123', 10);
            db.run(
                "INSERT INTO users (first_name,last_name,email,username,password,role) VALUES (?,?,?,?,?,?)",
                ['Admin', 'User', 'admin@busticket.com', 'admin', hashed, 'admin'],
                () => console.log('✅ Default admin created  →  username: admin  |  password: admin123')
            );
        }
    });

    // ─── SEED DEFAULT BUSES ──────────────────────────────────────────────────
    db.get('SELECT COUNT(*) as count FROM buses', [], (err, row) => {
        if (!err && row.count === 0) {
            const seedBuses = [
                ['Royal Express',    'A/C Sleeper (2+1)',       'New York', 'Washington D.C.', '2026-03-25', '08:30 PM', '06:15 AM', '9h 45m', 55, 18, 4.8, 1],
                ['Galaxy Multi-Axle','Volvo A/C Semi Sleeper',  'New York', 'Washington D.C.', '2026-03-25', '10:00 PM', '07:45 AM', '9h 45m', 48,  4, 4.5, 1],
                ['Travelers Choice', 'Luxury Non-A/C Sleeper',  'Boston',   'New York',         '2026-03-26', '07:15 PM', '05:00 AM', '9h 45m', 35, 22, 4.2, 1],
            ];
            const stmt = `INSERT INTO buses (name,type,from_city,to_city,date,departure,arrival,duration,price,seats,rating,operator_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
            seedBuses.forEach(b => db.run(stmt, b));
            console.log('✅ Seeded 3 default buses.');
        }
    });

    // ─── SEED DEFAULT PROMO CODES ────────────────────────────────────────────
    db.get('SELECT COUNT(*) as count FROM promo_codes', [], (err, row) => {
        if (!err && row.count === 0) {
            const seedPromos = [
                ['SAVE20', 20, '2027-12-31'],
                ['WELCOME50', 50, '2027-12-31'],
            ];
            const stmt = `INSERT INTO promo_codes (code,discount_percentage,expiration_date) VALUES (?,?,?)`;
            seedPromos.forEach(p => db.run(stmt, p));
            console.log('✅ Seeded default promo codes.');
        }
    });
});

module.exports = db;
