// 1. Ask for username when the page loads
const myName = prompt("Welcome to Mela Hub! What is your name?") || "Anonymous";

// 2. Sneaky Trick: Intercept the old message sender to attach your username
const originalEmit = socket.emit;
socket.emit = function(eventName, data) {
    if (eventName === 'chat message' && typeof data === 'string') {
        originalEmit.call(socket, 'chat message', { user: myName, text: data });
    } else {
        originalEmit.call(socket, eventName, data);
    }
};

const chatWindow = document.getElementById('messages');

// 3. Handle receiving live messages
socket.on('chat message', (data) => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${data.user}:</strong> ${data.text}`;
    chatWindow.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});

// 4. Load Chat History
socket.on('chat history', (history) => {
    history.forEach(data => {
        const item = document.createElement('li');
        item.innerHTML = `<strong>${data.user}:</strong> ${data.text}`;
        chatWindow.appendChild(item);
    });
    window.scrollTo(0, document.body.scrollHeight);
});

// 5. Typing Indicator display
socket.on('typing', (isTyping) => {
    let indicator = document.getElementById('typing-indicator');
    if (isTyping) {
        if (!indicator) {
            indicator = document.createElement('li');
            indicator.id = 'typing-indicator';
            indicator.style.color = 'gray';
            indicator.style.fontStyle = 'italic';
            indicator.textContent = 'Someone is typing...';
            chatWindow.appendChild(indicator);
        }
    } else {
        if (indicator) indicator.remove();
    }
});
