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

// 6. Handle incoming voice notes!
socket.on('receive_audio', (data) => {
    if (!chatWindow) return;
    const item = document.createElement('div');
    item.style.marginBottom = "10px";
    item.innerHTML = `
        <span style="color: var(--primary); font-weight: bold;">${data.user} sent a voice note:</span><br>
        <audio controls src="${data.audio}" style="margin-top: 5px; height: 40px; max-width: 100%; border-radius: 20px;"></audio>
    `;
    chatWindow.appendChild(item);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// 7. WEBRTC VIDEO CALLING LOGIC (Floating UI)
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

let localStream;
let peerConnection;
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
    startCallBtn.style.display = 'none';
    videoUi.style.display = 'block';
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
    videoUi.style.display = 'none';
    startCallBtn.style.display = 'block';
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
};

socket.on('webrtc_offer', async (offer) => {
    startCallBtn.style.display = 'none';
    videoUi.style.display = 'block';
    await startMedia();
    peerConnection = createPeerConnection();
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('webrtc_answer', answer);
});

socket.on('webrtc_answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('webrtc_ice_candidate', async (candidate) => {
    if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
