const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 }); 

const users = {}; 

function getUsersInRoom(roomName) {
  return Object.values(users)
    .filter(user => user.room === roomName)
    .map(user => user.username);
}

io.on('connection', (socket) => {
  
  socket.on('join', (data) => {
    socket.join(data.room); 
    users[socket.id] = data; 
    console.log(`👤 ${data.username} joined room: ${data.room}`);
    
    socket.emit('system_message', `Welcome to room: ${data.room} 🔒`);
    socket.to(data.room).emit('system_message', `${data.username} joined the room 👋`);
    io.to(data.room).emit('room_users', getUsersInRoom(data.room));
  });

  socket.on('send_message', (data) => {
    const user = users[socket.id];
    if (user) io.to(user.room).emit('receive_message', { user: data.user, text: data.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  socket.on('send_image', (data) => {
    const user = users[socket.id];
    if (user) io.to(user.room).emit('receive_image', { user: data.user, image: data.image, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  // NEW: Listen for Voice Notes and broadcast them
  socket.on('send_audio', (data) => {
    const user = users[socket.id];
    if (user) io.to(user.room).emit('receive_audio', { user: data.user, audio: data.audio, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  socket.on('typing', (isTyping) => {
    const user = users[socket.id];
    if (user) socket.to(user.room).emit('user_typing', { user: user.username, isTyping });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      console.log(`❌ ${user.username} left room: ${user.room}`);
      io.to(user.room).emit('system_message', `${user.username} left the room 🏃`);
      delete users[socket.id];
      io.to(user.room).emit('room_users', getUsersInRoom(user.room));
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Mela hub running on http://localhost:${PORT}`);
});
