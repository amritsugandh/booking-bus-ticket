// routes/reviews.js — Reviews API Routes
const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ─── POST /api/reviews ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const { bus_id, user_id, rating, comment } = req.body;
    if (!bus_id || !user_id || !rating)
        return res.status(400).json({ success: false, message: 'bus_id, user_id, and rating are required.' });

    try {
        // Verify user actually booked this bus
        const booking = await db.asyncGet(
            "SELECT id FROM bookings WHERE bus_id=? AND user_id=? AND status='confirmed'",
            [bus_id, user_id]
        );
        if (!booking) {
            return res.status(403).json({ success: false, message: 'You can only review buses you have booked and paid for.' });
        }

        // Check if review already exists
        const existing = await db.asyncGet(
            "SELECT id FROM reviews WHERE bus_id=? AND user_id=?",
            [bus_id, user_id]
        );
        if (existing) {
            return res.status(400).json({ success: false, message: 'You have already reviewed this bus.' });
        }

        await db.asyncRun(
            'INSERT INTO reviews (user_id, bus_id, rating, comment) VALUES (?, ?, ?, ?)',
            [user_id, bus_id, parseInt(rating), comment || '']
        );

        // Update the average rating on the bus
        const avg = await db.asyncGet('SELECT AVG(rating) as avg_rating FROM reviews WHERE bus_id=?', [bus_id]);
        if (avg && avg.avg_rating) {
            await db.asyncRun('UPDATE buses SET rating=? WHERE id=?', [parseFloat(avg.avg_rating).toFixed(1), bus_id]);
        }

        res.status(201).json({ success: true, message: 'Review submitted successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/reviews/bus/:id ────────────────────────────────────────────────
router.get('/bus/:id', async (req, res) => {
    try {
        const reviews = await db.asyncAll(`
            SELECT r.*, u.first_name, u.last_name 
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.bus_id = ?
            ORDER BY r.created_at DESC
        `, [req.params.id]);
        res.json({ success: true, count: reviews.length, reviews });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
