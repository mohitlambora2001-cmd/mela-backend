const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const db = new sqlite3.Database('./mela.db');
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database Tables
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, text TEXT, room TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)");
});

const roomUsers = {}; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // AUTHENTICATION ENGINE
    socket.on('register', (data) => {
        const { username, password, room, secret } = data;
        db.get("SELECT username FROM users WHERE username = ?", [username], (err, row) => {
            if (row) {
                socket.emit('auth_error', 'Username is already taken!');
            } else {
                const hash = bcrypt.hashSync(password, 8);
                db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], function(err) {
                    if (err) socket.emit('auth_error', 'Registration failed.');
                    else socket.emit('auth_success', { username, room, secret });
                });
            }
        });
    });

    socket.on('login', (data) => {
        const { username, password, room, secret } = data;
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
            if (!row) {
                socket.emit('auth_error', 'Username not found!');
            } else {
                const isValid = bcrypt.compareSync(password, row.password);
                if (isValid) socket.emit('auth_success', { username, room, secret });
                else socket.emit('auth_error', 'Incorrect password!');
            }
        });
    });

    socket.on('join room', (data) => {
        const room = data.room || 'Global';
        const user = data.user || 'Anonymous';
        
        socket.join(room);
        socket.room = room;
        socket.user = user;

        if (!roomUsers[room]) roomUsers[room] = {};
        roomUsers[room][socket.id] = user;

        io.to(room).emit('room users', Object.values(roomUsers[room]));
        
        db.all("SELECT id, user, text, timestamp FROM messages WHERE room = ? ORDER BY id DESC LIMIT 50", [room], (err, rows) => {
            if (err) return console.error(err.message);
            socket.emit('chat history', rows.reverse());
        });
    });

    socket.on('chat message', (data) => {
        const room = socket.room || 'Global';
        db.run("INSERT INTO messages (user, text, room) VALUES (?, ?, ?)", [data.user, data.text, room], function(err) {
            if (err) return console.error(err.message);
            io.to(room).emit('chat message', { ...data, id: this.lastID, timestamp: new Date().toISOString() }); 
        });
    });

    socket.on('send_image', (data) => {
        const room = socket.room || 'Global';
        const imagePayload = `IMG_DATA:${data.image}`;
        db.run("INSERT INTO messages (user, text, room) VALUES (?, ?, ?)", [data.user, imagePayload, room], function(err) {
            if (err) return console.error(err.message);
            io.to(room).emit('receive_image', { ...data, id: this.lastID, timestamp: new Date().toISOString() }); 
        });
    });

    socket.on('send_video', (data) => {
        const room = socket.room || 'Global';
        const videoPayload = 'VID_DATA:' + data.video;
        db.run("INSERT INTO messages (user, text, room) VALUES (?, ?, ?)", [data.user, videoPayload, room], function(err) {
            if (err) return console.error(err.message);
            io.to(room).emit('receive_video', { ...data, id: this.lastID, timestamp: new Date().toISOString() }); 
        });
    });

    socket.on('delete_message', (id) => {
        const room = socket.room || 'Global';
        db.run("DELETE FROM messages WHERE id = ?", [id], function(err) {
            if (!err) io.to(room).emit('message_deleted', id);
        });
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
