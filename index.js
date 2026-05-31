const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CONFIGURATION: PASTE YOUR VAPID KEYS HERE
// ==========================================
const publicVapidKey = 'BLT7ctw9_w1T_Y4GAt0AWNRLiFBD_lweEevAGhLxTwbK5u0F7UKAHLkY30Y6US2pcvJght8gxI2r2WwZ4qhjy2k';
const privateVapidKey = '0H6xe-d-tuGZBQsnlHE1OVmGIptn7JyIGRFPsRN0oCY';

webpush.setVapidDetails('mailto:admin@melahub.com', publicVapidKey, privateVapidKey);

if (!process.env.DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL is missing!");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize Cloud Tables (Including Subscriptions)
pool.query(`
    CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, sender TEXT, text TEXT, room TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password TEXT);
    CREATE TABLE IF NOT EXISTS subscriptions (id SERIAL PRIMARY KEY, username TEXT, endpoint TEXT UNIQUE, p256dh TEXT, auth TEXT);
`).catch(err => console.error("DB Init Error:", err));

// Endpoint for frontend to save notification tokens
app.post('/subscribe', async (req, res) => {
    const { username, subscription } = req.body;
    try {
        await pool.query(
            `INSERT INTO subscriptions (username, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4) ON CONFLICT (endpoint) DO UPDATE SET username = $1`,
            [username, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
        );
        res.status(201).json({});
    } catch (err) { res.status(500).json({ error: 'Failed to subscribe' }); }
});

// Expose public key to frontend
app.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: publicVapidKey });
});

// Helper function to push system alerts to users not currently in the room
async function sendPushNotification(room, sender, text) {
    try {
        const cleanText = text.startsWith('IMG_DATA:') ? '📷 Sent an image' : text.startsWith('VID_DATA:') ? '🎥 Sent a video' : text;
        const res = await pool.query("SELECT endpoint, p256dh, auth FROM subscriptions WHERE username != $1", [sender]);
        
        const payload = JSON.stringify({ title: `${sender} (#${room})`, body: cleanText });

        res.rows.forEach(sub => {
            const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
            webpush.sendNotification(pushSubscription, payload).catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    pool.query("DELETE FROM subscriptions WHERE endpoint = $1", [sub.endpoint]);
                }
            });
        });
    } catch (err) { console.error("Push Error:", err); }
}

const roomUsers = {}; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register', async (data) => {
        const { username, password, room, secret } = data;
        try {
            const result = await pool.query("SELECT username FROM users WHERE username = $1", [username]);
            if (result.rows.length > 0) socket.emit('auth_error', 'Username is already taken!');
            else {
                const hash = bcrypt.hashSync(password, 8);
                await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hash]);
                socket.emit('auth_success', { username, room, secret });
            }
        } catch (err) { socket.emit('auth_error', 'Registration failed.'); }
    });

    socket.on('login', async (data) => {
        const { username, password, room, secret } = data;
        try {
            const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
            if (result.rows.length === 0) socket.emit('auth_error', 'Username not found!');
            else {
                if (bcrypt.compareSync(password, result.rows[0].password)) socket.emit('auth_success', { username, room, secret });
                else socket.emit('auth_error', 'Incorrect password!');
            }
        } catch (err) { socket.emit('auth_error', 'Login failed.'); }
    });

    socket.on('join room', async (data) => {
        const room = data.room || 'Global';
        const user = data.user || 'Anonymous';
        socket.join(room); socket.room = room; socket.user = user;
        if (!roomUsers[room]) roomUsers[room] = {};
        roomUsers[room][socket.id] = user;
        io.to(room).emit('room users', Object.values(roomUsers[room]));
        try {
            const res = await pool.query("SELECT id, sender AS user, text, timestamp FROM messages WHERE room = $1 ORDER BY id DESC LIMIT 50", [room]);
            socket.emit('chat history', res.rows.reverse());
        } catch (err) { console.error(err); }
    });

    socket.on('chat message', async (data) => {
        const room = socket.room || 'Global';
        try {
            const res = await pool.query("INSERT INTO messages (sender, text, room) VALUES ($1, $2, $3) RETURNING id, timestamp", [data.user, data.text, room]);
            io.to(room).emit('chat message', { ...data, id: res.rows[0].id, timestamp: res.rows[0].timestamp }); 
            sendPushNotification(room, data.user, data.text);
        } catch (err) { console.error(err); }
    });

    socket.on('send_image', async (data) => {
        const room = socket.room || 'Global';
        try {
            const res = await pool.query("INSERT INTO messages (sender, text, room) VALUES ($1, $2, $3) RETURNING id, timestamp", [data.user, `IMG_DATA:${data.image}`, room]);
            io.to(room).emit('receive_image', { ...data, id: res.rows[0].id, timestamp: res.rows[0].timestamp }); 
            sendPushNotification(room, data.user, `IMG_DATA:${data.image}`);
        } catch (err) { console.error(err); }
    });

    socket.on('send_video', async (data) => {
        const room = socket.room || 'Global';
        try {
            const res = await pool.query("INSERT INTO messages (sender, text, room) VALUES ($1, $2, $3) RETURNING id, timestamp", [data.user, `VID_DATA:${data.video}`, room]);
            io.to(room).emit('receive_video', { ...data, id: res.rows[0].id, timestamp: res.rows[0].timestamp }); 
            sendPushNotification(room, data.user, `VID_DATA:${data.video}`);
        } catch (err) { console.error(err); }
    });

    socket.on('disconnect', () => {
        if (socket.room && roomUsers[socket.room]) {
            delete roomUsers[socket.room][socket.id]; 
            io.to(socket.room).emit('room users', Object.values(roomUsers[socket.room])); 
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log("Server is running with Push Notifications"); });
