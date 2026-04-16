// routes/bookings.js — Booking API Routes
const express = require('express');
const router  = express.Router();
const db      = require('../database');

// ─── POST /api/bookings ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const { bus_id, passenger, seats, user_id } = req.body;
    if (!bus_id || !passenger || !seats || !seats.length)
        return res.status(400).json({ success: false, message: 'bus_id, passenger, and seats are required.' });

    try {
        const bus = await db.asyncGet('SELECT * FROM buses WHERE id=?', [bus_id]);
        if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });

        const seatList = Array.isArray(seats) ? seats : [seats];
        
        // Fetch existing bookings to check for seat conflicts
        const existingBookings = await db.asyncAll(
            "SELECT seats FROM bookings WHERE bus_id=? AND status != 'cancelled'", 
            [bus_id]
        );
        
        let allBookedSeats = [];
        existingBookings.forEach(b => {
            if (b.seats) {
                allBookedSeats = allBookedSeats.concat(b.seats.split(',').map(s => s.trim()));
            }
        });

        // Check for conflicts
        const conflicts = seatList.filter(s => allBookedSeats.includes(s.toString()));
        if (conflicts.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Seats already booked: ${conflicts.join(', ')}` 
            });
        }

        const availableSeats = bus.seats - allBookedSeats.length;
        if (availableSeats < seatList.length) {
            return res.status(400).json({ success: false, message: `Only ${availableSeats} seat(s) remaining.` });
        }

        const total       = bus.price * seatList.length;
        const booking_ref = 'BT' + Math.floor(100000 + Math.random() * 900000);

        // Feature 3 preparation: insert as 'pending'
        const result = await db.asyncRun(
            "INSERT INTO bookings (user_id,bus_id,passenger,seats,total_amount,booking_ref,status) VALUES (?,?,?,?,?,?,'pending')",
            [user_id || null, bus_id, passenger, seatList.join(','), total, booking_ref]
        );

        const updatedBus = await db.asyncGet('SELECT * FROM buses WHERE id=?', [bus_id]);
        res.status(201).json({
            success: true,
            message: 'Booking created. Awaiting payment.',
            booking: { 
                id: result.lastID, 
                booking_ref, 
                passenger, 
                seats: seatList.join(','), 
                total_amount: total, 
                bus_name: bus.name, 
                from: bus.from_city, 
                to: bus.to_city, 
                date: bus.date, 
                departure: bus.departure,
                status: 'pending'
            },
            remaining_seats: availableSeats - seatList.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/bookings ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        await db.autoRecycleSeats();
        const bookings = await db.asyncAll(`
            SELECT b.*, buses.name as bus_name, buses.from_city, buses.to_city, buses.date, buses.departure
            FROM bookings b JOIN buses ON b.bus_id=buses.id
            ORDER BY b.booked_at DESC`, []);
        res.json({ success: true, count: bookings.length, bookings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/bookings/user/:id ──────────────────────────────────────────────
router.get('/user/:id', async (req, res) => {
    try {
        await db.autoRecycleSeats();
        const bookings = await db.asyncAll(`
            SELECT b.*, buses.name as bus_name, buses.from_city, buses.to_city, buses.date, buses.departure
            FROM bookings b JOIN buses ON b.bus_id=buses.id
            WHERE b.user_id = ?
            ORDER BY b.booked_at DESC`, [req.params.id]);
        res.json({ success: true, count: bookings.length, bookings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Note: Auto-recycle is now handled globally via db.autoRecycleSeats()

// ─── DUMMY NOTIFICATION SERVICE ─────────────────────────────────────────────
const sendNotification = (user, type, booking) => {
    // Feature 5: Simulated Email/SMS
    console.log(`\n================= NOTIFICATION =================`);
    console.log(`To: ${user.email} / ${user.phone || 'Unknown Phone'}`);
    console.log(`Subject: ${type === 'PAYMENT' ? 'Booking Confirmed!' : 'Booking Cancelled'}`);
    console.log(`Message: Your booking ${booking.booking_ref} for ${booking.bus_name} has been ${type === 'PAYMENT' ? 'CONFIRMED' : 'CANCELLED'}.`);
    console.log(`================================================\n`);
};

// ─── POST /api/bookings/validate-promo ──────────────────────────────────────
router.post('/validate-promo', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Promo code required.' });
    
    try {
        const promo = await db.asyncGet('SELECT * FROM promo_codes WHERE code=? AND is_active=1', [code.toUpperCase()]);
        if (!promo) return res.status(404).json({ success: false, message: 'Invalid or expired promo code.' });
        
        // Very basic expiration check
        if (promo.expiration_date && new Date(promo.expiration_date) < new Date()) {
            return res.status(400).json({ success: false, message: 'Promo code expired.' });
        }
        
        res.json({ success: true, discount_percentage: promo.discount_percentage, promo_code: promo.code });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/bookings/:id/pay ──────────────────────────────────────────────
router.put('/:id/pay', async (req, res) => {
    const { promoCode } = req.body;
    try {
        const booking = await db.asyncGet(`
            SELECT b.*, buses.name as bus_name, u.email 
            FROM bookings b 
            JOIN buses ON b.bus_id = buses.id 
            LEFT JOIN users u ON b.user_id = u.id 
            WHERE b.id = ?`, [req.params.id]);
            
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
        if (booking.status === 'confirmed') return res.status(400).json({ success: false, message: 'Already paid.' });
        if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Booking is cancelled.' });

        let finalAmount = booking.total_amount;
        if (promoCode) {
            const promo = await db.asyncGet('SELECT * FROM promo_codes WHERE code=? AND is_active=1', [promoCode.toUpperCase()]);
            if (promo && (!promo.expiration_date || new Date(promo.expiration_date) >= new Date())) {
                const discount = finalAmount * (promo.discount_percentage / 100);
                finalAmount = finalAmount - discount;
            }
        }

        await db.asyncRun("UPDATE bookings SET status = 'confirmed', total_amount = ? WHERE id = ?", [finalAmount, req.params.id]);
        
        // Trigger simulated notification
        sendNotification({ email: booking.email || 'guest@example.com' }, 'PAYMENT', booking);

        res.json({ success: true, message: 'Payment successful.', status: 'confirmed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/bookings/:id/cancel ───────────────────────────────────────────
router.put('/:id/cancel', async (req, res) => {
    try {
        const booking = await db.asyncGet(`
            SELECT b.*, buses.name as bus_name, u.email 
            FROM bookings b 
            JOIN buses ON b.bus_id = buses.id 
            LEFT JOIN users u ON b.user_id = u.id 
            WHERE b.id = ?`, [req.params.id]);
            
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
        if (booking.status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled.' });

        // Calculate number of seats to refund
        const seatsCount = booking.seats ? booking.seats.split(',').length : 0;

        // Wallet Refund Logic (if user is logged in and booking was confirmed/paid)
        if (booking.user_id && booking.status === 'confirmed') {
            await db.asyncRun('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [booking.total_amount, booking.user_id]);
            console.log(`💰 Credited $${booking.total_amount} to User ID: ${booking.user_id} wallet.`);
        }

        await db.asyncRun("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [req.params.id]);

        // Trigger simulated notification
        sendNotification({ email: booking.email || 'guest@example.com' }, 'CANCEL', booking);

        res.json({ success: true, message: 'Booking cancelled. Refund credited to wallet if applicable.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
