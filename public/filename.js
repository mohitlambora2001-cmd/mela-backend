// 1. LOCAL STORAGE ENGINE (Remember Me)
let myName = localStorage.getItem('mela_username');
if (!myName) {
    myName = prompt("Welcome to Mela Hub! What is your name?") || "Anonymous";
    localStorage.setItem('mela_username', myName);
}

let myRoom = localStorage.getItem('mela_room');
if (!myRoom) {
    myRoom = prompt("Enter a Room Code (or leave blank for Global):") || "Global";
    localStorage.setItem('mela_room', myRoom);
}

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

// 2. THE UNIVERSAL CHAT PARSER
function appendImageToChat(user, base64Str) {
    const item = document.createElement('div');
    item.style.marginBottom = "12px";
    item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${user}:</span><br><img src="${base64Str}" style="max-width: 80%; max-height: 250px; border-radius: 8px; margin-top: 5px; border: 1px solid #444;" onclick="window.open(this.src)">`;
    chatWindow.appendChild(item);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendVideoToChat(user, base64Str) {
    const item = document.createElement('div');
    item.style.marginBottom = "12px";
    item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${user}:</span><br><video src="${base64Str}" controls style="max-width: 80%; max-height: 250px; border-radius: 8px; margin-top: 5px; border: 1px solid #444; background: #000;"></video>`;
    chatWindow.appendChild(item);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function parseIncomingMessage(data) {
    if (data.text.startsWith('IMG_DATA:')) {
        appendImageToChat(data.user, data.text.replace('IMG_DATA:', ''));
    } else if (data.text.startsWith('VID_DATA:')) {
        appendVideoToChat(data.user, data.text.replace('VID_DATA:', ''));
    } else {
        const item = document.createElement('div');
        item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${data.user}:</span> <span style="color: white;">${data.text}</span>`;
        chatWindow.appendChild(item);
    }
}

socket.on('chat message', (data) => { if (chatWindow) { parseIncomingMessage(data); chatWindow.scrollTop = chatWindow.scrollHeight; } });
socket.on('receive_image', (data) => { if (chatWindow) appendImageToChat(data.user, data.image); });
socket.on('receive_video', (data) => { if (chatWindow) appendVideoToChat(data.user, data.video); });

socket.on('chat history', (history) => {
    if (!chatWindow) return;
    chatWindow.innerHTML = ''; 
    history.forEach(data => parseIncomingMessage(data));
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// 3. MEDIA UPLOADERS (Images, Video, Audio)
setTimeout(() => {
    const imgInput = document.getElementById('imageInput');
    if (imgInput) {
        imgInput.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) { socket.emit('send_image', { user: myName, image: event.target.result }); };
            reader.readAsDataURL(file);
        };
    }
}, 1000);

const videoInput = document.createElement('input');
videoInput.type = 'file';
videoInput.accept = 'video/mp4,video/webm,video/ogg';
videoInput.style.display = 'none';
document.body.appendChild(videoInput);

const videoBtn = document.createElement('button');
videoBtn.innerHTML = '🎥';
videoBtn.style.cssText = 'position:fixed; top:130px; right:10px; background:#eab308; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);';
document.body.appendChild(videoBtn);

videoBtn.onclick = () => videoInput.click();
videoInput.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        alert("Whoa there! Please select a video under 5MB.");
        return;
    }
    const reader = new FileReader();
    reader.onload = function(event) { socket.emit('send_video', { user: myName, video: event.target.result }); };
    reader.readAsDataURL(file);
};

socket.on('receive_audio', (data) => {
    if (!chatWindow) return;
    const item = document.createElement('div');
    item.style.marginBottom = "10px";
    item.innerHTML = `<span style="color: var(--primary); font-weight: bold;">${data.user} sent a voice note:</span><br><audio controls src="${data.audio}" style="margin-top: 5px; height: 40px; max-width: 100%; border-radius: 20px;"></audio>`;
    chatWindow.appendChild(item);
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

// 4. WEBRTC VIDEO CALLING LOGIC
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

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startCallBtn = document.getElementById('start-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const videoUi = document.getElementById('video-ui');
let localStream; let peerConnection;
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function startMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
}
function createPeerConnection() {
    const pc = new RTCPeerConnection(servers);
    pc.onicecandidate = event => { if (event.candidate) socket.emit('webrtc_ice_candidate', event.candidate); };
    pc.ontrack = event => { remoteVideo.srcObject = event.streams[0]; };
    return pc;
}

startCallBtn.onclick = async () => {
    startCallBtn.style.display = 'none'; videoUi.style.display = 'block';
    await startMedia();
    peerConnection = createPeerConnection();
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('webrtc_offer', offer);
};

endCallBtn.onclick = () => {
    if(peerConnection) peerConnection.close();
    if(localStream) localStream.getTracks().forEach(track => track.stop());
    videoUi.style.display = 'none'; startCallBtn.style.display = 'block';
    remoteVideo.srcObject = null; localVideo.srcObject = null;
};

socket.on('webrtc_offer', async (offer) => {
    startCallBtn.style.display = 'none'; videoUi.style.display = 'block';
    await startMedia();
    peerConnection = createPeerConnection();
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('webrtc_answer', answer);
});

socket.on('webrtc_answer', async (answer) => { await peerConnection.setRemoteDescription(new RTCSessionDescription(answer)); });
socket.on('webrtc_ice_candidate', async (candidate) => { if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); });

// 5. CHANGE ROOM / LOGOUT BUTTON
const logoutBtn = document.createElement('button');
logoutBtn.innerHTML = '🔄';
logoutBtn.style.cssText = 'position:fixed; top:190px; right:10px; background:#444; color:white; border:none; width:50px; height:50px; border-radius:50%; z-index:999; cursor:pointer; font-size:20px; box-shadow: 0px 4px 10px rgba(0,0,0,0.3);';
document.body.appendChild(logoutBtn);

logoutBtn.onclick = () => {
    if(confirm("Log out and change rooms?")) {
        localStorage.removeItem('mela_username');
        localStorage.removeItem('mela_room');
        window.location.reload();
    }
};
