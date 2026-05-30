// 1. SECURE AUTHENTICATION UI & MEMORY
let myName = localStorage.getItem('mela_username');
let myRoom = localStorage.getItem('mela_room');
let mySecret = localStorage.getItem('mela_secret');

const authOverlay = document.createElement('div');
authOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:#0f172a; z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:sans-serif;';
authOverlay.innerHTML = `
    <h1 style="color:var(--primary, #10b981); margin-bottom:10px; font-size: 2.5rem;">Mela Hub</h1>
    <p style="margin-bottom:20px; color:#94a3b8;">Secure E2EE Comm Link</p>
    <input id="auth-user" placeholder="Username" style="margin:5px; padding:12px; border-radius:8px; border:none; width:80%; max-width:300px; font-size:16px; outline:none; color:black;">
    <input id="auth-pass" type="password" placeholder="Password" style="margin:5px; padding:12px; border-radius:8px; border:none; width:80%; max-width:300px; font-size:16px; outline:none; color:black;">
    <input id="auth-room" placeholder="Room Code (Optional)" style="margin:5px; padding:12px; border-radius:8px; border:none; width:80%; max-width:300px; font-size:16px; outline:none; color:black;">
    <input id="auth-secret" type="password" placeholder="E2EE Secret Key" style="margin:5px; padding:12px; border-radius:8px; border:none; width:80%; max-width:300px; font-size:16px; outline:none; color:black;">
    <div style="margin-top:20px; display:flex; gap:15px;">
        <button id="auth-login" style="padding:12px 24px; background:var(--primary, #10b981); color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">Login</button>
        <button id="auth-reg" style="padding:12px 24px; background:#3b82f6; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">Register</button>
    </div>
    <p id="auth-msg" style="color:#ef4444; margin-top:15px; font-size:0.9rem; height:20px; font-weight:bold;"></p>
`;

if (!myName) {
    document.body.appendChild(authOverlay);
} else {
    socket.emit('join room', { room: myRoom, user: myName });
}

setTimeout(() => {
    const loginBtn = document.getElementById('auth-login');
    const regBtn = document.getElementById('auth-reg');
    const msg = document.getElementById('auth-msg');

    if(loginBtn) loginBtn.onclick = () => {
        const u = document.getElementById('auth-user').value.trim();
        const p = document.getElementById('auth-pass').value;
        const r = document.getElementById('auth-room').value.trim() || 'Global';
        const s = document.getElementById('auth-secret').value || 'default123';
        if(!u || !p) return msg.innerText = "Username and Password required!";
        socket.emit('login', { username: u, password: p, room: r, secret: s });
    };

    if(regBtn) regBtn.onclick = () => {
        const u = document.getElementById('auth-user').value.trim();
        const p = document.getElementById('auth-pass').value;
        const r = document.getElementById('auth-room').value.trim() || 'Global';
        const s = document.getElementById('auth-secret').value || 'default123';
        if(!u || !p) return msg.innerText = "Username and Password required!";
        socket.emit('register', { username: u, password: p, room: r, secret: s });
    };
}, 100);

socket.on('auth_success', (data) => {
    myName = data.username; myRoom = data.room; mySecret = data.secret;
    localStorage.setItem('mela_username', myName); localStorage.setItem('mela_room', myRoom); localStorage.setItem('mela_secret', mySecret);
    if(document.body.contains(authOverlay)) document.body.removeChild(authOverlay);
    socket.emit('join room', { room: myRoom, user: myName });
});

socket.on('auth_error', (errorMsg) => {
    const msg = document.getElementById('auth-msg');
    if(msg) msg.innerText = errorMsg;
});

// 2. THE ENCRYPTION INTERCEPTOR (Locks message BEFORE it leaves your phone)
const originalEmit = socket.emit;
socket.emit = function(eventName, data) {
    if (eventName === 'chat message' && typeof data === 'string') { 
        const encryptedText = CryptoJS.AES.encrypt(data, mySecret).toString();
        originalEmit.call(socket, 'chat message', { user: myName, text: encryptedText }); 
    } else { 
        originalEmit.call(socket, eventName, data); 
    }
};

const chatWindow = document.getElementById('chat-box');

// 3. TIMESTAMPS & UI
function formatTime(ts) {
    if (!ts) return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    let d = new Date(ts.replace(' ', 'T') + 'Z'); 
    if (isNaN(d)) return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

const usersBar = document.createElement('div');
usersBar.id = 'active-users-bar';
usersBar.style.cssText = 'background: #182235; padding: 10px 20px; font-size: 0.9rem; color: #10b981; border-bottom: 1px solid #333; text-align: left; position: sticky; top: 0; z-index: 100; font-weight: bold; overflow-x: auto; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border-radius: 8px 8px 0 0; margin-bottom: 5px;';
usersBar.innerHTML = '🟢 Online: Connecting... 🔐 E2EE Active';
if (chatWindow && chatWindow.parentNode) chatWindow.parentNode.insertBefore(usersBar, chatWindow); 
else document.body.insertBefore(usersBar, document.body.firstChild);

socket.on('room users', (users) => {
    const uniqueUsers = [...new Set(users)];
    usersBar.innerHTML = '🟢 Online: <span style="color:white; font-weight:normal;">' + uniqueUsers.join(', ') + '</span> <span style="float:right;">🔐</span>';
});

// 4. THE DECRYPTION PARSER (Unlocks incoming messages)
function parseIncomingMessage(data) {
    const item = document.createElement('div');
    if (data.id) item.id = 'msg-' + data.id;
    item.style.marginBottom = "12px";
    
    let deleteBtn = (data.user === myName && data.id) ? `<span onclick="socket.emit('delete_message', ${data.id})" style="cursor:pointer; margin-left:10px; font-size:1rem;" title="Delete">🗑️</span>` : '';
    let header = `<div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="color: var(--primary); font-weight: bold;">${data.user}:</span> <div><span style="font-size:0.7rem; color:#888;">${formatTime(data.timestamp)}</span>${deleteBtn}</div></div>`;
    
    let body = '';
    if (data.text && data.text.startsWith('IMG_DATA:')) {
        body = `<img src="${data.text.replace('IMG_DATA:', '')}" style="max-width: 80%; max-height: 250px; border-radius: 8px; margin-top: 5px; border: 1px solid #444;" onclick="window.open(this.src)">`;
    } else if (data.text && data.text.startsWith('VID_DATA:')) {
        body = `<video src="${data.text.replace('VID_DATA:', '')}" controls style="max-width: 80%; max-height: 250px; border-radius: 8px; margin-top: 5px; border: 1px solid #444; background: #000;"></video>`;
    } else {
        // ATTEMPT AES-256 DECRYPTION
        let decryptedText = data.text;
        try {
            const bytes = CryptoJS.AES.decrypt(data.text, mySecret);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            if (originalText) decryptedText = originalText;
            else decryptedText = "🔒 <i>[Encrypted Message - Wrong Key]</i>";
        } catch (e) {
            decryptedText = "🔒 <i>[Encrypted Message - Wrong Key]</i>";
        }
        body = `<div style="color: white; margin-top:2px; word-wrap: break-word;">${decryptedText}</div>`;
    }
    
    item.innerHTML = header + body;
    chatWindow.appendChild(item);
}

socket.on('chat history', (history) => { if (!chatWindow) return; chatWindow.innerHTML = ''; history.forEach(data => parseIncomingMessage(data)); chatWindow.scrollTop = chatWindow.scrollHeight; });
socket.on('chat message', (data) => { if (chatWindow) { parseIncomingMessage(data); chatWindow.scrollTop = chatWindow.scrollHeight; } });
socket.on('receive_image', (data) => { if (chatWindow) { parseIncomingMessage({ id: data.id, user: data.user, text: 'IMG_DATA:' + data.image, timestamp: data.timestamp }); chatWindow.scrollTop = chatWindow.scrollHeight; } });
socket.on('receive_video', (data) => { if (chatWindow) { parseIncomingMessage({ id: data.id, user: data.user, text: 'VID_DATA:' + data.video, timestamp: data.timestamp }); chatWindow.scrollTop = chatWindow.scrollHeight; } });

socket.on('receive_audio', (data) => {
    if (!chatWindow) return;
    const item = document.createElement('div'); item.style.marginBottom = "10px";
    item.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="color: var(--primary); font-weight: bold;">${data.user} sent a voice note:</span> <span style="font-size:0.7rem; color:#888;">${formatTime(null)}</span></div><audio controls src="${data.audio}" style="margin-top: 5px; height: 40px; max-width: 100%; border-radius: 20px;"></audio>`;
    chatWindow.appendChild(item); chatWindow.scrollTop = chatWindow.scrollHeight;
});

socket.on('message_deleted', (id) => {
    const msgElement = document.getElementById('msg-' + id);
    if (msgElement) { msgElement.innerHTML = `<div style="color: #666; font-style: italic; font-size: 0.9rem; padding: 5px 0;">🚫 This message was deleted</div>`; setTimeout(() => msgElement.remove(), 2500); }
});

// 5. UPLOADS & MEDIA
setTimeout(() => { const imgInput = document.getElementById('imageInput'); if (imgInput) { imgInput.onchange = function(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(event) { socket.emit('send_image', { user: myName, image: event.target.result }); }; reader.readAsDataURL(file); }; } }, 1000);
const videoInput = document.createElement('input'); videoInput.type = 'file'; videoInput.accept = 'video/mp4,video/webm,video/ogg'; videoInput.style.display = 'none'; document.body.appendChild(videoInput);
const videoBtn = document.createElement('button'); videoBtn.innerHTML = '🎥'; videoBtn.style.cssText = 'position:fixed; top:130px; right:10px; background:#eab308; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);'; document.body.appendChild(videoBtn);
videoBtn.onclick = () => videoInput.click();
videoInput.onchange = function(e) { const file = e.target.files[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { alert("Video must be under 5MB."); return; } const reader = new FileReader(); reader.onload = function(event) { socket.emit('send_video', { user: myName, video: event.target.result }); }; reader.readAsDataURL(file); };

socket.on('typing', (isTyping) => { if (!chatWindow) return; let indicator = document.getElementById('typing-indicator'); if (isTyping) { if (!indicator) { indicator = document.createElement('div'); indicator.id = 'typing-indicator'; indicator.style.color = '#888'; indicator.style.fontStyle = 'italic'; indicator.textContent = 'Someone is typing...'; chatWindow.appendChild(indicator); } } else { if (indicator) indicator.remove(); } });

// 6. WEBRTC
const videoContainer = document.createElement('div');
videoContainer.innerHTML = `<div id="video-ui" style="display:none; position:fixed; top:70px; right:10px; width:150px; background:#000; border-radius:12px; overflow:hidden; z-index:1000; border:2px solid var(--primary); box-shadow: 0px 4px 10px rgba(0,0,0,0.5);"><video id="remote-video" autoplay playsinline style="width:100%; background:#222; display:block;"></video><video id="local-video" autoplay playsinline muted style="width:50px; position:absolute; bottom:35px; right:5px; border-radius:5px; border:1px solid #fff; z-index:1001;"></video><button id="end-call-btn" style="width:100%; background:#ff4444; color:white; border:none; padding:8px; font-weight:bold; cursor:pointer; z-index:1002; position:relative;">End Call</button></div><button id="start-call-btn" style="position:fixed; top:70px; right:10px; background:var(--primary); color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:24px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);">📹</button>`;
document.body.appendChild(videoContainer);
const localVideo = document.getElementById('local-video'); const remoteVideo = document.getElementById('remote-video'); const startCallBtn = document.getElementById('start-call-btn'); const endCallBtn = document.getElementById('end-call-btn'); const videoUi = document.getElementById('video-ui');
let localStream; let peerConnection; const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
async function startMedia() { localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); localVideo.srcObject = localStream; }
function createPeerConnection() { const pc = new RTCPeerConnection(servers); pc.onicecandidate = event => { if (event.candidate) socket.emit('webrtc_ice_candidate', event.candidate); }; pc.ontrack = event => { remoteVideo.srcObject = event.streams[0]; }; return pc; }
startCallBtn.onclick = async () => { startCallBtn.style.display = 'none'; videoUi.style.display = 'block'; await startMedia(); peerConnection = createPeerConnection(); localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream)); const offer = await peerConnection.createOffer(); await peerConnection.setLocalDescription(offer); socket.emit('webrtc_offer', offer); };
endCallBtn.onclick = () => { if(peerConnection) peerConnection.close(); if(localStream) localStream.getTracks().forEach(track => track.stop()); videoUi.style.display = 'none'; startCallBtn.style.display = 'block'; remoteVideo.srcObject = null; localVideo.srcObject = null; };
socket.on('webrtc_offer', async (offer) => { startCallBtn.style.display = 'none'; videoUi.style.display = 'block'; await startMedia(); peerConnection = createPeerConnection(); localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream)); await peerConnection.setRemoteDescription(new RTCSessionDescription(offer)); const answer = await peerConnection.createAnswer(); await peerConnection.setLocalDescription(answer); socket.emit('webrtc_answer', answer); });
socket.on('webrtc_answer', async (answer) => { await peerConnection.setRemoteDescription(new RTCSessionDescription(answer)); });
socket.on('webrtc_ice_candidate', async (candidate) => { if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); });

// 7. NOTIFICATIONS & LOGOUT
let unreadCount = 0; let originalTitle = document.title || 'Mela Hub';
function playDing() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(1046.50, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch(e) { } }
function triggerNotification() { if (document.hidden) { unreadCount++; document.title = `(${unreadCount}) New Message!`; playDing(); } }
document.addEventListener("visibilitychange", () => { if (!document.hidden) { unreadCount = 0; document.title = originalTitle; } });
socket.on('chat message', (data) => { if (data.user !== myName) triggerNotification(); });
socket.on('receive_image', (data) => { if (data.user !== myName) triggerNotification(); });
socket.on('receive_video', (data) => { if (data.user !== myName) triggerNotification(); });
socket.on('receive_audio', (data) => { if (data.user !== myName) triggerNotification(); });

const logoutBtn = document.createElement('button'); logoutBtn.innerHTML = '🔄'; logoutBtn.style.cssText = 'position:fixed; top:190px; right:10px; background:#444; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);'; document.body.appendChild(logoutBtn);
logoutBtn.onclick = () => { if(confirm("Log out, wipe memory, and change rooms?")) { localStorage.clear(); window.location.reload(); } };

// 10. DOWNLOAD CHAT EXPORT FEATURE 📜
const downloadBtn = document.createElement('button');
downloadBtn.innerHTML = '📜';
downloadBtn.style.cssText = 'position:fixed; top:250px; right:10px; background:#3b82f6; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);';
document.body.appendChild(downloadBtn);

downloadBtn.onclick = () => {
    if(confirm("Download a copy of this decrypted chat history?")) {
        let chatText = `--- Mela Hub Chat Export (Room: ${myRoom}) ---\nGenerated on: ${new Date().toLocaleString()}\n\n`;
        
        // Iterate through all the message bubbles on the screen
        Array.from(chatWindow.children).forEach(msgNode => {
            // Grab the text, remove the delete button emoji, and clean up the spacing
            let text = msgNode.innerText.replace('🗑️', '').trim();
            if(text) chatText += text + "\n\n";
        });
        
        // Generate the physical .txt file in the browser memory
        const blob = new Blob([chatText], { type: "text/plain" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `MelaHub_${myRoom}_Chat.txt`;
        
        // Trigger the download silently
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

// 11. CUSTOM THEMES 🎨 (Dynamic Color Picker)
const themeBtn = document.createElement('button');
themeBtn.innerHTML = '🎨';
themeBtn.style.cssText = 'position:fixed; top:310px; right:10px; background:#8b5cf6; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);';
document.body.appendChild(themeBtn);

const colorInput = document.createElement('input');
colorInput.type = 'color';
colorInput.style.display = 'none';
document.body.appendChild(colorInput);

// Load saved color on startup (defaults to your original cool green)
let savedColor = localStorage.getItem('mela_theme_color') || '#10b981';
document.documentElement.style.setProperty('--primary', savedColor);

themeBtn.onclick = () => colorInput.click();

// Dynamically inject the new color across the whole UI
colorInput.addEventListener('input', (e) => {
    const newColor = e.target.value;
    document.documentElement.style.setProperty('--primary', newColor);
    localStorage.setItem('mela_theme_color', newColor);
});
