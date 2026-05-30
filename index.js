const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const db = new sqlite3.Database('./mela.db');
app.use(express.static(path.join(__dirname, 'public')));

// THE ONLINE TRACKER MEMORY
const roomUsers = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join room', (data) => {
        // Parse the room and username
        const room = typeof data === 'string' ? data : data.room;
        const user = typeof data === 'string' ? 'Anonymous' : data.user;
        
        socket.join(room);
        socket.room = room;
        socket.user = user;

        // Add user to the room's memory bank
        if (!roomUsers[room]) roomUsers[room] = {};
        roomUsers[room][socket.id] = user;

        // Broadcast the active list to everyone in this specific room
        io.to(room).emit('room users', Object.values(roomUsers[room]));
        
        db.all("SELECT user, text, timestamp FROM messages WHERE room = ? ORDER BY id DESC LIMIT 50", [room], (err, rows) => {
            if (err) return console.error(err.message);
            socket.emit('chat history', rows.reverse());
        });
    });

    socket.on('chat message', (data) => {
        const room = socket.room || 'Global';
        db.run("INSERT INTO messages (user, text, room) VALUES (?, ?, ?)", [data.user, data.text, room], function(err) {
            if (err) return console.error(err.message);
            io.to(room).emit('chat message', data); 
        });
    });

    socket.on('send_image', (data) => {
        const room = socket.room || 'Global';
        const imagePayload = `IMG_DATA:${data.image}`;
        db.run("INSERT INTO messages (user, text, room) VALUES (?, ?, ?)", [data.user, imagePayload, room], function(err) {
            if (err) return console.error(err.message);
            io.to(room).emit('receive_image', data); 
        });
    });

    socket.on('send_video', (data) => {
        const room = socket.room || 'Global';
        const videoPayload = 'VID_DATA:' + data.video;
        db.run("INSERT INTO messages (user, text, room) VALUES (?, ?, ?)", [data.user, videoPayload, room], function(err) {
            if (err) return console.error(err.message);
            io.to(room).emit('receive_video', data); 
        });
    });

    socket.on('webrtc_offer', (event) => { socket.broadcast.to(socket.room || 'Global').emit('webrtc_offer', event); });
    socket.on('webrtc_answer', (event) => { socket.broadcast.to(socket.room || 'Global').emit('webrtc_answer', event); });
    socket.on('webrtc_ice_candidate', (event) => { socket.broadcast.to(socket.room || 'Global').emit('webrtc_ice_candidate', event); });

    socket.on('typing', (status) => {
        if (socket.room) socket.to(socket.room).emit('typing', status);
    });

    // Detect when someone closes the app!
    socket.on('disconnect', () => {
        if (socket.room && roomUsers[socket.room]) {
            delete roomUsers[socket.room][socket.id]; // Remove them from memory
            io.to(socket.room).emit('room users', Object.values(roomUsers[socket.room])); // Update everyone else
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
