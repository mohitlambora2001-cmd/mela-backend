// 1. MEMORY ENGINE & JOIN
let myName = localStorage.getItem('mela_username');
if (!myName) { myName = prompt("Welcome to Mela Hub! What is your name?") || "Anonymous"; localStorage.setItem('mela_username', myName); }
let myRoom = localStorage.getItem('mela_room');
if (!myRoom) { myRoom = prompt("Enter a Room Code (or leave blank for Global):") || "Global"; localStorage.setItem('mela_room', myRoom); }

socket.emit('join room', { room: myRoom, user: myName });

const originalEmit = socket.emit;
socket.emit = function(eventName, data) {
    if (eventName === 'chat message' && typeof data === 'string') { originalEmit.call(socket, 'chat message', { user: myName, text: data }); } 
    else { originalEmit.call(socket, eventName, data); }
};

const chatWindow = document.getElementById('chat-box');

// 2. TIMESTAMPS
function formatTime(ts) {
    if (!ts) return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    let d = new Date(ts.replace(' ', 'T') + 'Z'); 
    if (isNaN(d)) return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// 3. ONLINE USERS TRACKER UI
const usersBar = document.createElement('div');
usersBar.id = 'active-users-bar';
usersBar.style.cssText = 'background: #182235; padding: 10px 20px; font-size: 0.9rem; color: var(--primary, #10b981); border-bottom: 1px solid #333; text-align: left; position: sticky; top: 0; z-index: 100; font-weight: bold; overflow-x: auto; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border-radius: 8px 8px 0 0; margin-bottom: 5px;';
usersBar.innerHTML = '🟢 Online: Connecting...';
if (chatWindow && chatWindow.parentNode) { chatWindow.parentNode.insertBefore(usersBar, chatWindow); } 
else { document.body.insertBefore(usersBar, document.body.firstChild); }

socket.on('room users', (users) => {
    const uniqueUsers = [...new Set(users)];
    usersBar.innerHTML = '🟢 Online: <span style="color:white; font-weight:normal;">' + uniqueUsers.join(', ') + '</span>';
});

// 4. UNIVERSAL MESSAGE PARSER (Now with Delete Buttons!)
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
        body = `<div style="color: white; margin-top:2px; word-wrap: break-word;">${data.text}</div>`;
    }
    
    item.innerHTML = header + body;
    chatWindow.appendChild(item);
}

// 5. MESSAGE EVENTS
socket.on('chat history', (history) => {
    if (!chatWindow) return; chatWindow.innerHTML = ''; 
    history.forEach(data => parseIncomingMessage(data));
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

socket.on('chat message', (data) => { if (chatWindow) { parseIncomingMessage(data); chatWindow.scrollTop = chatWindow.scrollHeight; } });
socket.on('receive_image', (data) => { if (chatWindow) { parseIncomingMessage({ id: data.id, user: data.user, text: 'IMG_DATA:' + data.image, timestamp: data.timestamp }); chatWindow.scrollTop = chatWindow.scrollHeight; } });
socket.on('receive_video', (data) => { if (chatWindow) { parseIncomingMessage({ id: data.id, user: data.user, text: 'VID_DATA:' + data.video, timestamp: data.timestamp }); chatWindow.scrollTop = chatWindow.scrollHeight; } });

socket.on('receive_audio', (data) => {
    if (!chatWindow) return;
    const item = document.createElement('div');
    item.style.marginBottom = "10px";
    item.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:baseline;"><span style="color: var(--primary); font-weight: bold;">${data.user} sent a voice note:</span> <span style="font-size:0.7rem; color:#888;">${formatTime(null)}</span></div><audio controls src="${data.audio}" style="margin-top: 5px; height: 40px; max-width: 100%; border-radius: 20px;"></audio>`;
    chatWindow.appendChild(item);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// NEW: Handle Live Message Deletion!
socket.on('message_deleted', (id) => {
    const msgElement = document.getElementById('msg-' + id);
    if (msgElement) {
        msgElement.innerHTML = `<div style="color: #666; font-style: italic; font-size: 0.9rem; padding: 5px 0;">🚫 This message was deleted</div>`;
        setTimeout(() => msgElement.remove(), 2500); 
    }
});

// 6. MEDIA UPLOADS
setTimeout(() => {
    const imgInput = document.getElementById('imageInput');
    if (imgInput) {
        imgInput.onchange = function(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) { socket.emit('send_image', { user: myName, image: event.target.result }); };
            reader.readAsDataURL(file);
        };
    }
}, 1000);

const videoInput = document.createElement('input'); videoInput.type = 'file'; videoInput.accept = 'video/mp4,video/webm,video/ogg'; videoInput.style.display = 'none'; document.body.appendChild(videoInput);
const videoBtn = document.createElement('button'); videoBtn.innerHTML = '🎥'; videoBtn.style.cssText = 'position:fixed; top:130px; right:10px; background:#eab308; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);'; document.body.appendChild(videoBtn);
videoBtn.onclick = () => videoInput.click();
videoInput.onchange = function(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Video must be under 5MB."); return; }
    const reader = new FileReader();
    reader.onload = function(event) { socket.emit('send_video', { user: myName, video: event.target.result }); };
    reader.readAsDataURL(file);
};

// Typing
socket.on('typing', (isTyping) => {
    if (!chatWindow) return;
    let indicator = document.getElementById('typing-indicator');
    if (isTyping) {
        if (!indicator) {
            indicator = document.createElement('div'); indicator.id = 'typing-indicator'; indicator.style.color = '#888'; indicator.style.fontStyle = 'italic'; indicator.textContent = 'Someone is typing...'; chatWindow.appendChild(indicator);
        }
    } else { if (indicator) indicator.remove(); }
});

// 7. WEBRTC VIDEO CALLING
const videoContainer = document.createElement('div');
videoContainer.innerHTML = `
    <div id="video-ui" style="display:none; position:fixed; top:70px; right:10px; width:150px; background:#000; border-radius:12px; overflow:hidden; z-index:1000; border:2px solid var(--primary); box-shadow: 0px 4px 10px rgba(0,0,0,0.5);">
        <video id="remote-video" autoplay playsinline style="width:100%; background:#222; display:block;"></video>
        <video id="local-video" autoplay playsinline muted style="width:50px; position:absolute; bottom:35px; right:5px; border-radius:5px; border:1px solid #fff; z-index:1001;"></video>
        <button id="end-call-btn" style="width:100%; background:#ff4444; color:white; border:none; padding:8px; font-weight:bold; cursor:pointer; z-index:1002; position:relative;">End Call</button>
    </div>
    <button id="start-call-btn" style="position:fixed; top:70px; right:10px; background:var(--primary); color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:24px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);">📹</button>
`;
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

// 8. LOGOUT BUTTON
const logoutBtn = document.createElement('button'); logoutBtn.innerHTML = '🔄'; logoutBtn.style.cssText = 'position:fixed; top:190px; right:10px; background:#444; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);'; document.body.appendChild(logoutBtn);
logoutBtn.onclick = () => { if(confirm("Log out and change rooms?")) { localStorage.removeItem('mela_username'); localStorage.removeItem('mela_room'); window.location.reload(); } };
