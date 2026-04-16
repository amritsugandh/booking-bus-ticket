// routes/auth.js — Authentication API Routes
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database');

const JWT_SECRET = 'busticket_secret_key_2026';

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, username, password } = req.body;
    if (!first_name || !email || !password)
        return res.status(400).json({ success: false, message: 'First name, email, and password are required.' });

    try {
        const existing = await db.asyncGet('SELECT id FROM users WHERE email=? OR username=?', [email, username || email]);
        if (existing) return res.status(409).json({ success: false, message: 'User with this email or username already exists.' });

        const hashed = bcrypt.hashSync(password, 10);
        const result = await db.asyncRun(
            'INSERT INTO users (first_name,last_name,email,username,password,role) VALUES (?,?,?,?,?,?)',
            [first_name, last_name || '', email, username || email, hashed, 'user']
        );
        const token = jwt.sign({ id: result.lastID, email, name: `${first_name} ${last_name || ''}`, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, message: 'Account created!', token, user: { id: result.lastID, name: `${first_name} ${last_name || ''}`, email, role: 'user' } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required.' });

    try {
        const user = await db.asyncGet('SELECT * FROM users WHERE username=? OR email=?', [username, username]);
        if (!user) return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        if (!user.password) return res.status(401).json({ success: false, message: 'This account uses Google Sign-In.' });

        if (!bcrypt.compareSync(password, user.password))
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });

        const token = jwt.sign({ id: user.id, email: user.email, name: `${user.first_name} ${user.last_name}`, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, message: 'Login successful!', token, user: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ─── POST /api/auth/admin-login ──────────────────────────────────────────────
// Admin-only login endpoint — rejects non-admin role
router.post('/admin-login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required.' });

    try {
        const user = await db.asyncGet('SELECT * FROM users WHERE (username=? OR email=?) AND role=?', [username, username, 'admin']);
        if (!user) return res.status(403).json({ success: false, message: 'Access denied. No admin account found with these credentials.' });

        if (!bcrypt.compareSync(password, user.password))
            return res.status(401).json({ success: false, message: 'Incorrect password.' });

        const token = jwt.sign({ id: user.id, email: user.email, name: `${user.first_name} ${user.last_name}`, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, message: 'Admin login successful!', token, user: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, role: 'admin' } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ─── GET /api/auth/users (admin only) ───────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const users = await db.asyncAll(
            'SELECT id, first_name, last_name, email, username, role, google_id, created_at FROM users ORDER BY created_at DESC', []
        );
        res.json({ success: true, count: users.length, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

    try {
        const user = await db.asyncGet('SELECT * FROM users WHERE email=?', [email]);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        // Generate mock token
        const resetToken = 'reset_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        const resetExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        await db.asyncRun('UPDATE users SET reset_token=?, reset_expires=? WHERE id=?', [resetToken, resetExpires, user.id]);

        console.log(`\n================= PASSWORD RESET =================`);
        console.log(`To: ${email}`);
        console.log(`Link: http://localhost:3000/reset-password.html?token=${resetToken}`);
        console.log(`==================================================\n`);

        res.json({ success: true, message: 'Password reset link sent to your email.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password required.' });

    try {
        const user = await db.asyncGet('SELECT * FROM users WHERE reset_token=?', [token]);
        if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token.' });

        if (new Date(user.reset_expires) < new Date()) {
            return res.status(400).json({ success: false, message: 'Token has expired.' });
        }

        const hashed = bcrypt.hashSync(newPassword, 10);
        await db.asyncRun('UPDATE users SET password=?, reset_token=NULL, reset_expires=NULL WHERE id=?', [hashed, user.id]);

        res.json({ success: true, message: 'Password reset successfully. You can now login.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/auth/google ───────────────────────────────────────────────────
router.post('/google', async (req, res) => {
    const { google_id, name, email, picture } = req.body;
    if (!email || !name) return res.status(400).json({ success: false, message: 'Invalid Google data.' });

    try {
        let user = await db.asyncGet('SELECT * FROM users WHERE email=?', [email]);
        if (!user) {
            const parts  = name.split(' ');
            const result = await db.asyncRun(
                'INSERT INTO users (first_name,last_name,email,username,google_id,avatar,role) VALUES (?,?,?,?,?,?,?)',
                [parts[0], parts.slice(1).join(' '), email, email, google_id || email, picture || '', 'user']
            );
            user = await db.asyncGet('SELECT * FROM users WHERE id=?', [result.lastID]);
        } else if (!user.google_id) {
            await db.asyncRun('UPDATE users SET google_id=?, avatar=? WHERE id=?', [google_id || email, picture || '', user.id]);
        }

        const token = jwt.sign({ id: user.id, email, name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, message: 'Google login successful!', token, user: { id: user.id, name, email, avatar: picture, role: user.role } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ─── GET /api/auth/profile/:id ──────────────────────────────────────────────
router.get('/profile/:id', async (req, res) => {
    try {
        const user = await db.asyncGet('SELECT id, first_name, last_name, email, username, phone, address, emergency_contact, wallet_balance, role, avatar FROM users WHERE id=?', [req.params.id]);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/auth/profile/:id ──────────────────────────────────────────────
router.put('/profile/:id', async (req, res) => {
    const { first_name, last_name, phone, address, emergency_contact } = req.body;
    try {
        await db.asyncRun(
            'UPDATE users SET first_name=?, last_name=?, phone=?, address=?, emergency_contact=? WHERE id=?',
            [first_name, last_name, phone, address, emergency_contact, req.params.id]
        );
        res.json({ success: true, message: 'Profile updated successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/auth/change-password ──────────────────────────────────────────
router.put('/change-password', async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    if (!userId || !oldPassword || !newPassword) return res.status(400).json({ success: false, message: 'All fields required.' });

    try {
        const user = await db.asyncGet('SELECT password FROM users WHERE id=?', [userId]);
        if (!user || !user.password) return res.status(400).json({ success: false, message: 'User not found or using social login.' });

        if (!bcrypt.compareSync(oldPassword, user.password)) {
            return res.status(401).json({ success: false, message: 'Incorrect old password.' });
        }

        const hashed = bcrypt.hashSync(newPassword, 10);
        await db.asyncRun('UPDATE users SET password=? WHERE id=?', [hashed, userId]);
        res.json({ success: true, message: 'Password updated!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
