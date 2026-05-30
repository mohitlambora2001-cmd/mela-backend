const socket = io('https://mela-backend.onrender.com');

socket.on('chat message', (msg) => {
    const chatWindow = document.getElementById('messages');
    const item = document.createElement('li');
    item.textContent = msg;
    chatWindow.appendChild(item);
});
