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

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. Listen for users joining a specific room
    socket.on('join room', (room) => {
        socket.join(room);
        socket.room = room; // Save the room name to this user's socket
        
        // 2. Fetch history ONLY for this secret room
        db.all("SELECT user, text FROM messages WHERE room = ? ORDER BY id DESC LIMIT 50", [room], (err, rows) => {
            if (err) return console.error(err.message);
            socket.emit('chat history', rows.reverse());
        });
    });

    // 3. Save messages with the room tag, and only broadcast to that room
    socket.on('chat message', (data) => {
        const room = socket.room || 'Global';
        db.run("INSERT INTO messages (user, text, room) VALUES (?, ?, ?)", [data.user, data.text, room], function(err) {
            if (err) return console.error(err.message);
            io.to(room).emit('chat message', data); 
        });
    });

    // 4. Isolate the typing indicator to the specific room
    socket.on('typing', (status) => {
        if (socket.room) socket.to(socket.room).emit('typing', status);
    });

socket.on('send_audio', (data) => {
        const room = socket.room || 'Global';
        io.to(room).emit('receive_audio', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
