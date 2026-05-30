const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 1. Serve your frontend files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// 2. The Message History Array (saves the last 50 messages)
let messageHistory = [];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send history to whoever just opened the app
    socket.emit('chat history', messageHistory);

    // 3. Listen for messages (Now handles Usernames!)
    socket.on('chat message', (data) => {
        messageHistory.push(data);
        if (messageHistory.length > 50) messageHistory.shift(); // Keep only the latest 50
        
        io.emit('chat message', data); // Broadcast to the room
    });

    // 4. Typing Indicator Logic
    socket.on('typing', (status) => {
        socket.broadcast.emit('typing', status); // Tells everyone else you are typing
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
