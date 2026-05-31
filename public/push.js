function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function initPushNotifications(username) {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            const register = await navigator.serviceWorker.register('/sw.js');
            const response = await fetch('/vapid-public-key');
            const { publicKey } = await response.json();
            const convertedVapidKey = urlBase64ToUint8Array(publicKey);
            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
            await fetch('/subscribe', {
                method: 'POST',
                body: JSON.stringify({ username, subscription }),
                headers: { 'content-type': 'application/json' }
            });
        } catch (err) { console.error(err); }
    }
}
