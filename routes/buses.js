// routes/buses.js — Bus Management API Routes
const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ─── GET /api/buses ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const { from, to, date, type, minPrice, maxPrice, operator_id } = req.query;
    let sql = `
        SELECT buses.*, IFNULL(GROUP_CONCAT(bookings.seats), '') as booked_seats
        FROM buses
        LEFT JOIN bookings ON buses.id = bookings.bus_id 
          AND (bookings.status = 'confirmed' OR bookings.status = 'pending')
          AND buses.date >= date('now')
        WHERE 1=1
    `;
    const args = [];
    if (from) { sql += ' AND LOWER(buses.from_city) LIKE LOWER(?)'; args.push(`%${from}%`); }
    if (to)   { sql += ' AND LOWER(buses.to_city) LIKE LOWER(?)';   args.push(`%${to}%`);   }
    if (date) { sql += ' AND buses.date=?';                          args.push(date);         }
    if (type) { sql += ' AND LOWER(buses.type) LIKE LOWER(?)';       args.push(`%${type}%`);  }
    if (minPrice) { sql += ' AND buses.price >= ?';                  args.push(minPrice);     }
    if (maxPrice) { sql += ' AND buses.price <= ?';                  args.push(maxPrice);     }
    if (operator_id) { sql += ' AND buses.operator_id = ?';          args.push(operator_id);  }
    
    sql += ' GROUP BY buses.id ORDER BY buses.id ASC';

    try {
        await db.autoRecycleSeats();

        const rows = await db.asyncAll(sql, args);
        // Format booked_seats into an array and apply Dynamic Pricing
        const buses = rows.map(b => {
            const booked = b.booked_seats ? b.booked_seats.split(',').filter(s => s.trim() !== '') : [];
            const availableSeats = b.seats - booked.length;
            
            // Feature 1: Dynamic Pricing & Surge Pricing
            // If available seats are less than 20% of total seats, increase price by 20%
            let finalPrice = b.price;
            let isSurge = false;
            if (availableSeats < (0.2 * b.seats)) {
                finalPrice = finalPrice * 1.2;
                isSurge = true;
            }

            return {
                ...b,
                price: parseFloat(finalPrice.toFixed(2)),
                original_price: b.price,
                is_surge: isSurge,
                booked_seats: booked,
                available_seats: availableSeats
            };
        });
        res.json({ success: true, count: buses.length, buses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/buses/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const bus = await db.asyncGet('SELECT * FROM buses WHERE id=?', [req.params.id]);
        if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });
        res.json({ success: true, bus });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/buses ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const { name, type, from_city, to_city, date, departure, arrival, duration, price, seats, operator_id } = req.body;
    if (!name || !type || !from_city || !to_city || !date || !departure || !arrival || !price)
        return res.status(400).json({ success: false, message: 'All required fields must be filled.' });

    try {
        const result = await db.asyncRun(
            'INSERT INTO buses (name,type,from_city,to_city,date,departure,arrival,duration,price,seats,operator_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [name, type, from_city, to_city, date, departure, arrival, duration || 'N/A', parseFloat(price), parseInt(seats) || 30, operator_id || 1]
        );
        const bus = await db.asyncGet('SELECT * FROM buses WHERE id=?', [result.lastID]);
        res.status(201).json({ success: true, message: 'Bus added successfully!', bus });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/buses/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const bus = await db.asyncGet('SELECT id FROM buses WHERE id=?', [req.params.id]);
        if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });
        await db.asyncRun('DELETE FROM buses WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Bus deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/buses/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    const { name, type, from_city, to_city, date, departure, arrival, duration, price, seats, operator_id } = req.body;
    if (!name || !type || !from_city || !to_city || !date || !departure || !arrival || !price)
        return res.status(400).json({ success: false, message: 'All required fields must be filled.' });

    try {
        const bus = await db.asyncGet('SELECT id FROM buses WHERE id=?', [req.params.id]);
        if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });

        await db.asyncRun(
            'UPDATE buses SET name=?, type=?, from_city=?, to_city=?, date=?, departure=?, arrival=?, duration=?, price=?, seats=?, operator_id=? WHERE id=?',
            [name, type, from_city, to_city, date, departure, arrival, duration || 'N/A', parseFloat(price), parseInt(seats) || 30, operator_id || 1, req.params.id]
        );
        res.json({ success: true, message: 'Bus updated successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
