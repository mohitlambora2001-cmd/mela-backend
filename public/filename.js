// 1. Ask for username when the page loads
const myName = prompt("Welcome to Mela Hub! What is your name?") || "Anonymous";

// 2. Intercept the old message sender to attach your username
const originalEmit = socket.emit;
socket.emit = function(eventName, data) {
    if (eventName === 'chat message' && typeof data === 'string') {
        originalEmit.call(socket, 'chat message', { user: myName, text: data });
    } else {
        originalEmit.call(socket, eventName, data);
    }
};

// FIX: Target your specific custom UI ID
const chatWindow = document.getElementById('chat-box');

// 3. Handle receiving live messages
socket.on('chat message', (data) => {
    if (!chatWindow) return;
    const item = document.createElement('div'); // Changed to div for your flexbox layout
    item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${data.user}:</span> <span style="color: white;">${data.text}</span>`;
    chatWindow.appendChild(item);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// 4. Load Chat History
socket.on('chat history', (history) => {
    if (!chatWindow) return;
    history.forEach(data => {
        const item = document.createElement('div');
        item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${data.user}:</span> <span style="color: white;">${data.text}</span>`;
        chatWindow.appendChild(item);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// 5. Typing Indicator display
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
