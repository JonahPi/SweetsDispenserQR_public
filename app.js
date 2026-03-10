// Sweets Dispenser PWA – Challenge Mode
// Reads the `key` URL parameter, presents a math challenge, then publishes key/points/mode/challenge to MQTT.

const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC  = 'SweetsReward';
const MQTT_CLIENT = 'SweetsDispenserPWA-' + Math.random().toString(16).slice(2, 8);

const key = new URLSearchParams(window.location.search).get('key');

// --- Utility ---
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- View management ---
function showView(id) {
    document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
    document.getElementById(id).hidden = false;
}

// --- Math question generation ---
// Returns { a, op, b, c } where a op b = c
function generateQuestion(op, einstein) {
    let a, b, c;

    if (!einstein) {
        // Kids mode: single-digit operands (2–9, never 0 or 1), result 3–9
        switch (op) {
            case '+':
                // a,b ≥ 2 → min result 4
                c = randInt(4, 9);
                a = randInt(2, c - 2);
                b = c - a;
                break;
            case '-':
                // b ≥ 2, a = c+b ≤ 9 → c ≤ 7
                c = randInt(3, 7);
                b = randInt(2, 9 - c);
                a = c + b;
                break;
            case '*':
                do { a = randInt(2, 9); b = randInt(2, 9); c = a * b; } while (c < 4 || c > 9);
                break;
            case '/':
                // b ≥ 2, a = c*b ≤ 9 → c ≤ 4
                c = randInt(2, 4);
                b = randInt(2, Math.floor(9 / c));
                a = c * b;
                break;
        }
    } else {
        // Einstein mode
        switch (op) {
            case '+':
                // result 31–199, 2-digit operands
                do { a = randInt(15, 99); b = randInt(16, 100); c = a + b; } while (c < 31 || c > 199);
                break;
            case '-':
                // result 11–129, 3-digit minuend (a) minus 3-digit subtrahend (b)
                c = randInt(11, 129);
                b = randInt(100, 200);
                a = c + b;
                break;
            case '*':
                // result 31–199, max 2-digit operands
                do { a = randInt(3, 14); b = randInt(3, 14); c = a * b; } while (c < 31 || c > 199);
                break;
            case '/':
                // result 11–19, max 2-digit operands (a = c * b ≤ 99)
                c = randInt(11, 19);
                b = randInt(2, Math.floor(99 / c));
                a = c * b;
                break;
        }
    }
    return { a, op, b, c };
}

// --- MQTT: publish result in background, update status text ---
// mode: 'kids' | 'std'   challenge: 'mathe' | 'physik' | 'erdkunde' | 'geschichte'
function publishResultTo(statusEl, points, mode, challenge) {
    const payload = key + '/' + points + '/' + mode + '/' + challenge;
    const client = mqtt.connect(MQTT_BROKER, {
        clientId: MQTT_CLIENT,
        connectTimeout: 10000,
    });

    client.on('connect', () => {
        client.publish(MQTT_TOPIC, payload, { qos: 1 }, (err) => {
            client.end();
            if (err) {
                statusEl.textContent = '❌ Senden fehlgeschlagen: ' + err.message;
            } else {
                statusEl.textContent = '✅ Ergebnis übermittelt!';
            }
        });
    });

    client.on('error', (err) => {
        statusEl.textContent = '❌ Verbindung fehlgeschlagen: ' + err.message;
    });

    setTimeout(() => {
        if (!client.connected) {
            client.end(true);
            statusEl.textContent = '❌ Zeitüberschreitung. Ergebnis nicht übermittelt.';
        }
    }, 12000);
}

// --- Credits ---
let creditsRemaining = 4;

function updateHomeScreen() {
    document.getElementById('credits-display').textContent = 'Credits: ' + creditsRemaining;
    const expired = creditsRemaining <= 0;
    ['btn-mathe', 'btn-physik', 'btn-erdkunde', 'btn-geschichte'].forEach(id => {
        document.getElementById(id).disabled = expired;
    });
    document.getElementById('no-credits-msg').hidden = !expired;
}

// --- Mathe challenge ---
let questions = [];
let submitted = false;

function startMathe() {
    submitted = false;
    const einstein = document.getElementById('mode-toggle').checked;
    const ops = ['+', '-', '*', '/'];
    questions = ops.map(op => generateQuestion(op, einstein));

    const container = document.getElementById('equations');
    container.innerHTML = '';

    questions.forEach((q, i) => {
        const sym = q.op === '*' ? '×' : q.op === '/' ? '÷' : q.op;
        const row = document.createElement('div');
        row.className = 'equation-row';
        row.innerHTML =
            `<span class="equation-text">${q.a} ${sym} ${q.b} =</span>` +
            `<input class="answer-input" type="number" id="ans-${i}" inputmode="numeric">` +
            `<span class="result-indicator" id="res-${i}"></span>`;
        container.appendChild(row);
    });

    document.getElementById('points-display').hidden = true;
    document.getElementById('mqtt-status').hidden = true;
    document.getElementById('btn-senden').textContent = 'Senden';

    showView('view-mathe');
    setTimeout(() => document.getElementById('ans-0').focus(), 100);
}

function doSubmit() {
    submitted = true;
    let correct = 0;

    questions.forEach((q, i) => {
        const input = document.getElementById('ans-' + i);
        const resEl = document.getElementById('res-' + i);
        const userVal = parseInt(input.value, 10);
        input.disabled = true;

        if (userVal === q.c) {
            correct++;
            resEl.textContent = '✓';
            resEl.className = 'result-indicator correct';
        } else {
            resEl.textContent = `✗ (${q.c})`;
            resEl.className = 'result-indicator wrong';
        }
    });

    const points = correct === 4 ? 2 : correct === 3 ? 1 : 0;
    const pointsEl = document.getElementById('points-display');
    const pointsMsgs = ['0 Punkte – Kein Süßes 😅', '1 Punkt – 1 M&M 🍬', '2 Punkte – 2 M&Ms 🍬🍬'];
    pointsEl.textContent = pointsMsgs[points];
    pointsEl.hidden = false;

    creditsRemaining--;
    document.getElementById('btn-senden').textContent = 'Neu Starten';

    const mode = document.getElementById('mode-toggle').checked ? 'std' : 'kids';
    publishResultTo(document.getElementById('mqtt-status'), points, mode, 'mathe');
}

document.getElementById('btn-senden').addEventListener('click', () => {
    if (submitted) {
        submitted = false;
        showView('view-home');
        updateHomeScreen();
    } else {
        doSubmit();
    }
});

// --- Multiple-Choice challenge ---
let mcQuestions = [];
let mcAnswers   = [];
let mcSubject   = '';
let mcSubmitted = false;

function startMC(subject, pool) {
    mcSubject   = subject;
    mcSubmitted = false;
    const einstein = document.getElementById('mode-toggle').checked;
    const filtered = pool.filter(q => einstein ? q.d : !q.d);
    // Pick 4 random questions
    const shuffled = filtered.slice().sort(() => Math.random() - 0.5);
    mcQuestions = shuffled.slice(0, 4);
    mcAnswers   = [null, null, null, null];

    document.getElementById('mc-title').textContent = subject;
    document.getElementById('mc-points-display').hidden = true;
    document.getElementById('mc-mqtt-status').hidden    = true;
    document.getElementById('btn-mc-senden').textContent = 'Senden';

    const container = document.getElementById('mc-questions');
    container.innerHTML = '';
    mcQuestions.forEach((q, qi) => {
        const block = document.createElement('div');
        block.className = 'mc-block';
        block.innerHTML = `<p class="mc-question-text">${q.q}</p>`;
        q.o.forEach((opt, oi) => {
            const btn = document.createElement('button');
            btn.className  = 'mc-option';
            btn.textContent = opt;
            btn.dataset.qi  = qi;
            btn.dataset.oi  = oi;
            btn.addEventListener('click', () => {
                if (mcSubmitted) return;
                mcAnswers[qi] = oi;
                // highlight selection
                block.querySelectorAll('.mc-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
            block.appendChild(btn);
        });
        container.appendChild(block);
    });

    showView('view-mc');
}

function submitMC() {
    mcSubmitted = true;
    let correct = 0;
    mcQuestions.forEach((q, qi) => {
        const block = document.getElementById('mc-questions').children[qi];
        block.querySelectorAll('.mc-option').forEach((btn, oi) => {
            btn.disabled = true;
            if (oi === q.a) {
                btn.classList.add('mc-correct');
            } else if (oi === mcAnswers[qi] && mcAnswers[qi] !== q.a) {
                btn.classList.add('mc-wrong');
            }
        });
        if (mcAnswers[qi] === q.a) correct++;
    });

    const points   = correct === 4 ? 2 : correct === 3 ? 1 : 0;
    const msgs     = ['0 Punkte – Kein Süsses 😅', '1 Punkt – 1 M&M 🍬', '2 Punkte – 2 M&Ms 🍬🍬'];
    const pointsEl = document.getElementById('mc-points-display');
    pointsEl.textContent = msgs[points];
    pointsEl.hidden = false;

    creditsRemaining--;
    document.getElementById('btn-mc-senden').textContent = 'Neu Starten';

    const statusEl = document.getElementById('mc-mqtt-status');
    statusEl.textContent = '📡 Sende Ergebnis…';
    statusEl.hidden = false;
    const mode = document.getElementById('mode-toggle').checked ? 'std' : 'kids';
    publishResultTo(statusEl, points, mode, mcSubject.toLowerCase());
}

document.getElementById('btn-mc-senden').addEventListener('click', () => {
    if (mcSubmitted) {
        mcSubmitted = false;
        showView('view-home');
        updateHomeScreen();
    } else {
        submitMC();
    }
});

// --- Initialization ---
if (!key) {
    showView('view-error');
    document.getElementById('msg-error').textContent =
        'Kein Schlüssel in der URL. Bitte den QR-Code erneut scannen.';
} else {
    showView('view-home');
    updateHomeScreen();
    document.getElementById('btn-mathe').addEventListener('click', startMathe);
    document.getElementById('btn-physik').addEventListener('click',    () => startMC('Physik',    QUESTIONS_PHYSIK));
    document.getElementById('btn-erdkunde').addEventListener('click',  () => startMC('Erdkunde',  QUESTIONS_ERDKUNDE));
    document.getElementById('btn-geschichte').addEventListener('click',() => startMC('Geschichte',QUESTIONS_GESCHICHTE));
}

// --- Service worker ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
