// 1. Ask for username AND Room Code
const myName = prompt("Welcome to Mela Hub! What is your name?") || "Anonymous";
const myRoom = prompt("Enter a Room Code (or leave blank for Global):") || "Global";

// 2. Tell the server to put us in that room immediately
socket.emit('join room', myRoom);

const originalEmit = socket.emit;
socket.emit = function(eventName, data) {
    if (eventName === 'chat message' && typeof data === 'string') {
        originalEmit.call(socket, 'chat message', { user: myName, text: data });
    } else {
        originalEmit.call(socket, eventName, data);
    }
};

const chatWindow = document.getElementById('chat-box');

socket.on('chat message', (data) => {
    if (!chatWindow) return;
    const item = document.createElement('div');
    item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${data.user}:</span> <span style="color: white;">${data.text}</span>`;
    chatWindow.appendChild(item);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// FIX: Clear the window first so changing rooms doesn't stack old messages
socket.on('chat history', (history) => {
    if (!chatWindow) return;
    chatWindow.innerHTML = ''; 
    history.forEach(data => {
        const item = document.createElement('div');
        item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${data.user}:</span> <span style="color: white;">${data.text}</span>`;
        chatWindow.appendChild(item);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

socket.on('typing', (isTyping) => {
    if (!chatWindow) return;
    let indicator = document.getElementById('typing-indicator');
    if (isTyping) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.style.color = '#888';
            indicator.style.fontStyle = 'italic';
            indicator.textContent = 'Someone is typing...';
            chatWindow.appendChild(indicator);
        }
    } else {
        if (indicator) indicator.remove();
    }
});
