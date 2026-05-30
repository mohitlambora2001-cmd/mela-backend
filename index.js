const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Check for the Cloud Database URL
if (!process.env.DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL environment variable is missing!");
    process.exit(1);
}

// Connect to PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.static(path.join(__dirname, 'public')));

// Initialize Cloud Tables
pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, 
        sender TEXT, 
        text TEXT, 
        room TEXT, 
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, 
        username TEXT UNIQUE, 
        password TEXT
    );
`).catch(err => console.error("DB Init Error:", err));

const roomUsers = {}; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register', async (data) => {
        const { username, password, room, secret } = data;
        try {
            const result = await pool.query("SELECT username FROM users WHERE username = $1", [username]);
            if (result.rows.length > 0) {
                socket.emit('auth_error', 'Username is already taken!');
            } else {
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
            if (result.rows.length === 0) {
                socket.emit('auth_error', 'Username not found!');
            } else {
                const user = result.rows[0];
                if (bcrypt.compareSync(password, user.password)) socket.emit('auth_success', { username, room, secret });
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
        } catch (err) { console.error(err); }
    });

    socket.on('send_image', async (data) => {
        const room = socket.room || 'Global';
        try {
            const res = await pool.query("INSERT INTO messages (sender, text, room) VALUES ($1, $2, $3) RETURNING id, timestamp", [data.user, `IMG_DATA:${data.image}`, room]);
            io.to(room).emit('receive_image', { ...data, id: res.rows[0].id, timestamp: res.rows[0].timestamp }); 
        } catch (err) { console.error(err); }
    });

    socket.on('send_video', async (data) => {
        const room = socket.room || 'Global';
        try {
            const res = await pool.query("INSERT INTO messages (sender, text, room) VALUES ($1, $2, $3) RETURNING id, timestamp", [data.user, `VID_DATA:${data.video}`, room]);
            io.to(room).emit('receive_video', { ...data, id: res.rows[0].id, timestamp: res.rows[0].timestamp }); 
        } catch (err) { console.error(err); }
    });

    socket.on('delete_message', async (id) => {
        const room = socket.room || 'Global';
        try {
            await pool.query("DELETE FROM messages WHERE id = $1", [id]);
            io.to(room).emit('message_deleted', id);
        } catch (err) { console.error(err); }
    });

    socket.on('webrtc_offer', (event) => { socket.broadcast.to(socket.room || 'Global').emit('webrtc_offer', event); });
    socket.on('webrtc_answer', (event) => { socket.broadcast.to(socket.room || 'Global').emit('webrtc_answer', event); });
    socket.on('webrtc_ice_candidate', (event) => { socket.broadcast.to(socket.room || 'Global').emit('webrtc_ice_candidate', event); });
    socket.on('typing', (status) => { if (socket.room) socket.to(socket.room).emit('typing', status); });

    socket.on('disconnect', () => {
        if (socket.room && roomUsers[socket.room]) {
            delete roomUsers[socket.room][socket.id]; 
            io.to(socket.room).emit('room users', Object.values(roomUsers[socket.room])); 
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
