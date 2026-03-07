// Sweets Dispenser PWA
// Reads the `key` URL parameter and publishes it to the MQTT topic SweetsReward.

const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC  = 'SweetsReward';
const MQTT_CLIENT = 'SweetsDispenserPWA-' + Math.random().toString(16).slice(2, 8);

// --- Read key from URL ---
const key = new URLSearchParams(window.location.search).get('key');

// --- DOM helpers ---
function showSuccess(msg) {
    document.getElementById('state-connecting').hidden = true;
    document.getElementById('msg-success').textContent = msg;
    document.getElementById('state-success').hidden = false;
}

function showError(msg) {
    document.getElementById('state-connecting').hidden = true;
    document.getElementById('msg-error').textContent = msg;
    document.getElementById('state-error').hidden = false;
}

// --- Guard: key must be present ---
if (!key) {
    showError('No key found in URL. Please scan the QR code again.');
} else {
    const client = mqtt.connect(MQTT_BROKER, {
        clientId: MQTT_CLIENT,
        connectTimeout: 10000,
    });

    client.on('connect', () => {
        client.publish(MQTT_TOPIC, key, { qos: 1 }, (err) => {
            client.end();
            if (err) {
                showError('Connected but failed to publish: ' + err.message);
            } else {
                showSuccess(`Key "${key}" sent. Good luck! 🍬`);
            }
        });
    });

    client.on('error', (err) => {
        showError('Could not connect to MQTT broker: ' + err.message);
    });

    // Timeout if broker unreachable
    setTimeout(() => {
        if (!client.connected) {
            client.end(true);
            showError('Connection timed out. Please try again.');
        }
    }, 12000);
}

// --- Service worker ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
