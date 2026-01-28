/**
 * KOSMIK SAYOHAT - MVP (Fix Version 1.0.3)
 * Muallif: [Sizning Ismingiz]
 * Versiya: 1.0.3 (Loading Screen Fix + Manual Touch Mode)
 */

// ==========================================
// 1. SOZLAMALAR (CONFIG)
// ==========================================
const CONFIG = {
    sensitivityX: 3.0,
    sensitivityY: 2.2,
    snapDistance: 1.5,
    colors: {
        bg: 0x1a0b2e,
        primary: 0x00ffcc,
        highlight: 0xffff00
    },
    aiUpdateInterval: 100, // AI har 100ms da ishlaydi
    loadingTimeout: 10000  // 10 soniya kutish
};

const LEVELS = [
    { title: "BOSHLANISH", items: [{ emoji: "⭐", name: "YULDUZ" }], color: 0x44aaff },
    { title: "MEVALAR", items: [{ emoji: "🍎", name: "OLMA" }, { emoji: "🍌", name: "BANAN" }], color: 0xffaa00 },
    { title: "SHAKLLAR", items: [{ emoji: "🟥", name: "KVADRAT" }, { emoji: "🔵", name: "DOIRA" }, { emoji: "🔺", name: "UCH" }], color: 0xff0055 },
    { title: "KOSMOS", items: [{ emoji: "🌍", name: "YER" }, { emoji: "🚀", name: "RAKETA" }, { emoji: "🛸", name: "НЛО" }, { emoji: "🪐", name: "SATURN" }], color: 0x6a0dad },
    { title: "HAYVONLAR", items: [{ emoji: "🦁", name: "SHER" }, { emoji: "🐼", name: "PANDA" }, { emoji: "🐘", name: "FIL" }, { emoji: "🐰", name: "QUYON" }], color: 0x228B22 }
];

// ==========================================
// 2. O'YIN HOLATI (STATE)
// ==========================================
const state = {
    levelIdx: 0,
    handPos: { x: 0, y: 0 },
    gesture: 'IDLE',      
    handVisible: false,
    inputType: 'CAMERA',  // 'CAMERA' yoki 'TOUCH'
    grabbedObj: null,
    hoveredObj: null,
    lockedCount: 0,
    totalPieces: 0,
    isTransitioning: false,
    playerName: "O'yinchi",
    isPlaying: false
};

// Vaqtni boshqarish
let startTime;
let totalTime = 0;
let lastAIProcessTime = 0;

// UI Elementlari
const ui = {
    loading: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    startScreen: document.getElementById('start-screen'),
    winScreen: document.getElementById('win-screen'),
    uiLayer: document.getElementById('ui-layer'),
    video: document.getElementById('input-video'),
    outCanvas: document.getElementById('output-canvas'),
    canvasCtx: document.getElementById('output-canvas').getContext('2d'),
    hintBubble: document.getElementById('hint-bubble'),
    timer: document.getElementById('timer-display'),
    progressFill: document.getElementById('progress-fill'),
    taskTitle: document.getElementById('task-title'),
    countdown: document.getElementById('countdown-overlay')
};

// ==========================================
// 3. OVOZ TIZIMI
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'pop') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'win') {
        [440, 554, 659].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle';
            o.connect(g); g.connect(audioCtx.destination);
            o.frequency.value = f;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.1, now + 0.1 + i*0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + 2);
            o.start(now); o.stop(now + 2);
        });
    }
}

// ==========================================
// 4. GRAFIKA (THREE.JS)
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.bg);
scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.03);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 12;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.touchAction = 'none'; 
document.getElementById('canvas-container').appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const piecesGroup = new THREE.Group();
const slotsGroup = new THREE.Group();
scene.add(piecesGroup);
scene.add(slotsGroup);

// Kursor
let cursorSprite;
function initCursor() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '100px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✋', 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    cursorSprite = new THREE.Sprite(mat);
    cursorSprite.scale.set(2, 2, 1);
    cursorSprite.visible = false;
    scene.add(cursorSprite);
}
initCursor();

function createTexture(emoji, text, color, isSlot = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    const hex = '#' + new THREE.Color(color).getHexString();
    ctx.fillStyle = isSlot ? "rgba(255,255,255,0.1)" : hex;
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = isSlot ? hex : "#ffffff";
    ctx.lineWidth = 10;
    if(isSlot) ctx.setLineDash([20, 10]);
    ctx.stroke();
    ctx.font = '100px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = isSlot ? 0.4 : 1.0;
    ctx.fillText(emoji, 128, 135);
    ctx.globalAlpha = 1.0;
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 270);
    ctx.fillText(text, 128, 270);
    return new THREE.CanvasTexture(canvas);
}

// ==========================================
// 5. O'YIN MANTIGI
// ==========================================
function initLevel(idx) {
    while(piecesGroup.children.length > 0) piecesGroup.remove(piecesGroup.children[0]);
    while(slotsGroup.children.length > 0) slotsGroup.remove(slotsGroup.children[0]);
    
    state.levelIdx = idx;
    state.lockedCount = 0;
    state.isTransitioning = false;
    
    const lvl = LEVELS[idx];
    ui.taskTitle.innerText = lvl.title;
    ui.taskTitle.style.borderColor = '#' + new THREE.Color(lvl.color).getHexString();
    
    const targetColor = new THREE.Color(lvl.color).lerp(new THREE.Color(0x000000), 0.7);
    scene.background = targetColor;
    scene.fog.color = targetColor;

    const items = [...lvl.items];
    const positions = [];
    const radius = window.innerWidth < 600 ? 2.5 : 3.5;
    
    for(let i=0; i<items.length; i++) {
        const angle = (i / items.length) * Math.PI * 2;
        positions.push(new THREE.Vector3(Math.cos(angle)*radius, Math.sin(angle)*radius, 0));
    }
    positions.sort(() => Math.random() - 0.5);

    items.forEach((item, i) => {
        const targetPos = positions[i];
        
        const slotTex = createTexture(item.emoji, item.name, lvl.color, true);
        const slot = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.5), new THREE.MeshBasicMaterial({ map: slotTex, transparent: true }));
        slot.position.copy(targetPos);
        slot.position.z = -0.5;
        slot.userData = { isSlot: true };
        slotsGroup.add(slot);

        const pieceTex = createTexture(item.emoji, item.name, lvl.color, false);
        const piece = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.9), new THREE.MeshBasicMaterial({ map: pieceTex, transparent: true }));
        piece.position.set((Math.random()-0.5)*3, (Math.random()-0.5)*3, 0.5 + i*0.1);
        piece.userData = { id: i, targetPos: targetPos, isLocked: false, name: item.name };
        piecesGroup.add(piece);
    });
    
    state.totalPieces = items.length;
    updateProgress(0);
}

function updateProgress(percent) {
    ui.progressFill.style.width = percent + '%';
}

function checkWin() {
    if (state.lockedCount === state.totalPieces) {
        playSound('win');
        state.isTransitioning = true;
        
        setTimeout(() => {
            if (state.levelIdx < LEVELS.length - 1) {
                ui.countdown.classList.remove('hidden');
                ui.countdown.innerText = "BARAKALLA!";
                setTimeout(() => {
                    initLevel(state.levelIdx + 1);
                    ui.countdown.classList.add('hidden');
                }, 2000);
            } else {
                showWinScreen();
            }
        }, 1000);
    }
}

function showWinScreen() {
    ui.winScreen.classList.remove('hidden');
    document.getElementById('restart-btn').classList.remove('hidden');
    saveScore(state.playerName, totalTime);
}

function saveScore(name, time) {
    let scores = JSON.parse(localStorage.getItem('kosmik_scores') || '[]');
    scores.push({ name, time });
    scores.sort((a,b) => a.time - b.time);
    localStorage.setItem('kosmik_scores', JSON.stringify(scores.slice(0, 5)));
    
    const html = scores.map((s, i) => `
        <div class="lb-row ${s.name === name ? 'lb-highlight' : ''}">
            <span>${i+1}. ${s.name}</span>
            <span>${Math.floor(s.time)}s</span>
        </div>
    `).join('');
    document.getElementById('lb-content').innerHTML = html;
}

// ==========================================
// 6. TOUCH / MOUSE NAZORATI
// ==========================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function handleInputMove(x, y) {
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;
    
    state.handVisible = true;
    if(state.inputType === 'TOUCH') {
        state.handPos.x = mouse.x;
        state.handPos.y = mouse.y;
    }
}

function handleInputStart() { state.gesture = 'PINCH'; }
function handleInputEnd() { state.gesture = 'IDLE'; }

window.addEventListener('mousedown', (e) => {
    if(state.inputType === 'TOUCH') { handleInputMove(e.clientX, e.clientY); handleInputStart(); }
});
window.addEventListener('mousemove', (e) => {
    if(state.inputType === 'TOUCH') handleInputMove(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => { if(state.inputType === 'TOUCH') handleInputEnd(); });
window.addEventListener('touchstart', (e) => {
    if(state.inputType === 'TOUCH' && e.touches.length > 0) {
        handleInputMove(e.touches[0].clientX, e.touches[0].clientY);
        handleInputStart();
    }
}, {passive: false});
window.addEventListener('touchmove', (e) => {
    if(state.inputType === 'TOUCH' && e.touches.length > 0) {
        e.preventDefault();
        handleInputMove(e.touches[0].clientX, e.touches[0].clientY);
    }
}, {passive: false});
window.addEventListener('touchend', () => { if(state.inputType === 'TOUCH') handleInputEnd(); });


// ==========================================
// 7. ANIMATSIYA
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);

    if (state.isTransitioning || !state.isPlaying) return;

    if (startTime) {
        totalTime = (Date.now() - startTime) / 1000;
        ui.timer.innerText = Math.floor(totalTime / 60).toString().padStart(2,'0') + ':' + (Math.floor(totalTime) % 60).toString().padStart(2,'0');
    }

    if (state.inputType === 'CAMERA') {
        mouse.x = Math.max(-1, Math.min(1, state.handPos.x));
        mouse.y = Math.max(-1, Math.min(1, state.handPos.y));
    }

    if (state.handVisible) {
        raycaster.setFromCamera(mouse, camera);
        
        const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const worldPos = new THREE.Vector3();
        raycaster.ray.intersectPlane(planeZ, worldPos);
        
        cursorSprite.position.copy(worldPos);
        cursorSprite.position.z = 2;
        cursorSprite.visible = true;
        cursorSprite.scale.setScalar(state.gesture === 'PINCH' ? 1.5 : 2.0);

        if (state.gesture === 'PINCH') {
            if (!state.grabbedObj && state.hoveredObj) {
                state.grabbedObj = state.hoveredObj;
                ui.hintBubble.innerText = "USHLANDI!";
                ui.hintBubble.style.color = "#00ff00";
            }
        } else {
            if (state.grabbedObj) {
                const obj = state.grabbedObj;
                const target = obj.userData.targetPos;
                const dist = obj.position.distanceTo(target);
                
                if (dist < CONFIG.snapDistance) {
                    obj.position.copy(target);
                    obj.position.z = 0.5;
                    obj.userData.isLocked = true;
                    playSound('pop');
                    state.lockedCount++;
                    updateProgress((state.lockedCount / state.totalPieces) * 100);
                    checkWin();
                }
                state.grabbedObj = null;
                ui.hintBubble.innerText = "BO'SH";
            }
        }

        if (state.grabbedObj) {
            state.grabbedObj.position.lerp(new THREE.Vector3(worldPos.x, worldPos.y, 2), 0.3);
        } else {
            const intersects = raycaster.intersectObjects(piecesGroup.children);
            if (intersects.length > 0) {
                const obj = intersects[0].object;
                if (!obj.userData.isLocked) {
                    state.hoveredObj = obj;
                    obj.scale.setScalar(1.2);
                    ui.hintBubble.classList.add('visible');
                    ui.hintBubble.innerText = "USHLA";
                }
            } else {
                if(state.hoveredObj) state.hoveredObj.scale.setScalar(1.0);
                state.hoveredObj = null;
                ui.hintBubble.classList.remove('visible');
            }
        }
    }
}

// ==========================================
// 8. O'YINNI BOSHLASH & INIT
// ==========================================
let hands; 

function onHandsResults(results) {
    if(state.inputType !== 'CAMERA') return;
    ui.canvasCtx.save();
    ui.canvasCtx.clearRect(0, 0, ui.outCanvas.width, ui.outCanvas.height);
    ui.canvasCtx.drawImage(results.image, 0, 0, ui.outCanvas.width, ui.outCanvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        state.handVisible = true;
        const lm = results.multiHandLandmarks[0];
        
        drawConnectors(ui.canvasCtx, lm, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(ui.canvasCtx, lm, {color: '#FF0000', lineWidth: 1});

        const x = (1 - lm[9].x) * 2 - 1;
        const y = (1 - lm[9].y) * 2 - 1;
        state.handPos.x += (x * CONFIG.sensitivityX - state.handPos.x) * 0.5;
        state.handPos.y += (-y * CONFIG.sensitivityY - state.handPos.y) * 0.5;
        const dist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        state.gesture = dist < 0.05 ? 'PINCH' : 'IDLE';
    } else {
        state.handVisible = false;
    }
    ui.canvasCtx.restore();
}

async function aiLoop() {
    if(state.inputType === 'CAMERA' && state.isPlaying && !ui.video.paused) {
        const now = Date.now();
        if(now - lastAIProcessTime > CONFIG.aiUpdateInterval) {
            await hands.send({image: ui.video});
            lastAIProcessTime = now;
        }
    }
    requestAnimationFrame(aiLoop);
}

function switchToTouchMode() {
    console.log("Touch rejimiga o'tilmoqda...");
    state.inputType = 'TOUCH';
    ui.loading.style.display = 'none';
    ui.startScreen.classList.add('hidden');
    ui.uiLayer.classList.remove('hidden');
    
    if(ui.video.srcObject) {
        ui.video.srcObject.getTracks().forEach(track => track.stop());
    }
    ui.video.style.display = 'none';
    ui.outCanvas.style.display = 'none';
    
    ui.outCanvas.width = window.innerWidth;
    ui.outCanvas.height = window.innerHeight;
    
    initLevel(0);
    state.isPlaying = true;
    startTime = Date.now();
    animate();
}

async function startGame() {
    const name = document.getElementById('player-name-input').value;
    if(!name) { alert("Ismingizni kiriting!"); return; }
    state.playerName = name;
    ui.startScreen.classList.add('hidden');
    ui.loading.style.display = 'flex'; 

    const loadTimer = setTimeout(() => {
        if(!state.isPlaying) {
            alert("Kamera yuklanmadi. Sensorli rejimga o'tilmoqda!");
            switchToTouchMode();
        }
    }, CONFIG.loadingTimeout);

    try {
        if(typeof Hands === 'undefined') { throw new Error("MediaPipe yuklanmagan"); }

        if(ui.loadingText) ui.loadingText.innerText = "AI Modeli yuklanmoqda...";
        
        hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        hands.onResults(onHandsResults);

        if(ui.loadingText) ui.loadingText.innerText = "Kamera ulanmoqda...";
        
        const cameraObj = new Camera(ui.video, {
            onFrame: async () => { },
            width: 640, height: 480
        });
        await cameraObj.start();
        
        clearTimeout(loadTimer);
        state.inputType = 'CAMERA';
        
        ui.loading.style.display = 'none';
        ui.uiLayer.classList.remove('hidden');
        ui.outCanvas.width = 640; ui.outCanvas.height = 480;
        
        initLevel(0);
        state.isPlaying = true;
        startTime = Date.now();
        
        animate(); 
        aiLoop();

    } catch (e) {
        clearTimeout(loadTimer);
        console.error(e);
        alert("Xatolik: " + e.message + "\nKamerasiz rejimga o'tilmoqda.");
        switchToTouchMode();
    }
}

// HODISALAR
document.getElementById('start-btn').addEventListener('click', startGame);

// Kamerasiz o'ynash tugmasi
document.getElementById('touch-btn').addEventListener('click', () => {
    const name = document.getElementById('player-name-input').value || "O'yinchi";
    state.playerName = name;
    switchToTouchMode();
});

document.getElementById('restart-btn').addEventListener('click', () => location.reload());

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// BUG FIX: SAHIFA YUKLANGANDA LOADINGNI O'CHIRISH
window.addEventListener('DOMContentLoaded', () => {
    // 1 soniyadan keyin menyuni ochish
    setTimeout(() => {
        if(ui.loading) ui.loading.style.display = 'none';
        if(ui.startScreen) ui.startScreen.classList.remove('hidden');
    }, 1000);
});