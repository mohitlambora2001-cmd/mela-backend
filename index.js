const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Connect to the SQLite Database
const db = new sqlite3.Database('./mela.db');

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. Fetch the last 50 messages from the database
    db.all("SELECT user, text FROM messages ORDER BY id DESC LIMIT 50", [], (err, rows) => {
        if (err) return console.error(err.message);
        // Reverse the rows so the newest messages stay at the bottom
        socket.emit('chat history', rows.reverse());
    });

    // 2. Listen for messages and SAVE them permanently
    socket.on('chat message', (data) => {
        db.run("INSERT INTO messages (user, text) VALUES (?, ?)", [data.user, data.text], function(err) {
            if (err) return console.error(err.message);
            
            // Broadcast to the room after saving
            io.emit('chat message', data); 
        });
    });

    socket.on('typing', (status) => {
        socket.broadcast.emit('typing', status);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
