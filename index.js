// 1. Add these imports at the very top of your file
const http = require('http');
const { Server } = require('socket.io');

// 2. Wrap your express app with http
const server = http.createServer(app);
const io = new Server(server);

// 3. Setup the real-time listener
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for chat messages
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg); // Broadcast to everyone
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// 4. IMPORTANT: Change app.listen to server.listen
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

