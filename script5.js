// Global o'zgaruvchilar
let audioCtx;
let isMusicPlaying = false;
let isSpeechEnabled = true;
let nextNoteTime = 0;
let noteIndex = 0;
let hands; 
let isHandProcessing = false; 
let playerName = ""; 
let gameState = 'PERMISSION'; 
let isClickCooldown = false;
let totalPlayedTime = 0; 
let lastFrameTime = 0;
let isTimerRunning = false;
let slowMoFactor = 1.0;
let ui = {}; // UI elementlari keyinroq yuklanadi
let cursorSprite;
let canvasCtx;

const melody = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

const CONFIG = {
    sensitivityX: 3.0, 
    sensitivityY: 2.2,
    snapDistance: 1.5,
};

const LEVELS = [
    { title: "BOSHLANISH", items: [{ emoji: "⭐", name: "YULDUZ" }], color: 0x44aaff },
    { title: "JUFTLIK", items: [{ emoji: "🍎", name: "OLMA" }, { emoji: "🍌", name: "BANAN" }], color: 0xffaa00 },
    { title: "UCHLIK", items: [{ emoji: "🟥", name: "KVADRAT" }, { emoji: "🔵", name: "DOIRA" }, { emoji: "🔺", name: "UCHBURCHAK" }], color: 0xff0055 },
    { title: "KOSMOS", items: [{ emoji: "🌍", name: "YER" }, { emoji: "🚀", name: "RAKETA" }, { emoji: "🛸", name: "UCHAR LAKOP" }, { emoji: "🪐", name: "SATURN" }], color: 0x6a0dad },
    { title: "HAYVONOT BOG'I", items: [{ emoji: "🦁", name: "SHER" }, { emoji: "🐼", name: "PANDA" }, { emoji: "🦊", name: "TULKI" }, { emoji: "🐘", name: "FIL" }, { emoji: "🐰", name: "QUYON" }], color: 0x228B22 }
];

const state = {
    levelIdx: 0,
    handPos: { x: 0, y: 0 },
    screenHandPos: { x: 0, y: 0 },
    gesture: 'IDLE',
    handVisible: false,
    handLabel: 'Right',
    grabbedObj: null,
    hoveredObj: null,
    lockedCount: 0,
    totalPieces: 0,
    isTransitioning: false,
    worldSize: { width: 10, height: 10 }
};

// THREE.JS INIT
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0b2e);
scene.fog = new THREE.FogExp2(0x1a0b2e, 0.025);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.sortObjects = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

const piecesGroup = new THREE.Group();
const slotsGroup = new THREE.Group();
const particlesGroup = new THREE.Group();
const trailsGroup = new THREE.Group(); 
scene.add(piecesGroup);
scene.add(slotsGroup);
scene.add(particlesGroup);
scene.add(trailsGroup);

// --- FUNKSIYALAR ---

function initCursor() {
    function createCursorTexture(emoji) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);
        ctx.font = '100px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = "rgba(0,255,204,0.8)"; ctx.shadowBlur = 15;
        ctx.fillText(emoji, 64, 70);
        return new THREE.CanvasTexture(canvas);
    }
    const texHandOpen = createCursorTexture('✋');
    const texHandPinch = createCursorTexture('👌');
    const cursorMat = new THREE.SpriteMaterial({ map: texHandOpen, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false });
    cursorSprite = new THREE.Sprite(cursorMat);
    cursorSprite.scale.set(1.5, 1.5, 1);
    cursorSprite.renderOrder = 999; 
    scene.add(cursorSprite);
    
    // Global referencelar saqlash
    cursorSprite.userData = { texOpen: texHandOpen, texPinch: texHandPinch };
}

function updateLayout() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const isMobile = window.innerWidth < 768;
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) { camera.position.z = 18; } else { camera.position.z = isMobile ? 14 : 11; }
    const vFOV = THREE.Math.degToRad(camera.fov);
    const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const width = height * camera.aspect;
    state.worldSize = { width, height };
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. UI elementlarini yuklash
    ui = {
        permScreen: document.getElementById('permission-screen'),
        enableBtn: document.getElementById('enable-cam-btn'),
        handCursor: document.getElementById('hand-cursor'),
        hintBubble: document.getElementById('hint-bubble'),
        startBtn: document.getElementById('start-btn'),
        nameInput: document.getElementById('player-name-input'),
        keyboard: document.getElementById('keyboard-container'),
        startScreen: document.getElementById('start-screen'),
        winScreen: document.getElementById('win-screen'),
        uiLayer: document.getElementById('ui-layer'),
        loading: document.getElementById('loading-container'),
        video: document.getElementById('input-video'),
        outCanvas: document.getElementById('output-canvas'),
        title: document.getElementById('task-title'),
        stepsContainer: document.getElementById('steps-container'),
        countdown: document.getElementById('countdown-overlay'),
        progressFill: document.getElementById('progress-fill'),
        restartBtn: document.getElementById('restart-btn'),
        timer: document.getElementById('timer-display'),
        lbContent: document.getElementById('lb-content'),
        leaderboard: document.getElementById('leaderboard'),
        nextMsg: document.getElementById('next-level-msg'),
        musicIcon: document.getElementById('music-icon'),
        speechIcon: document.getElementById('speech-icon')
    };

    document.getElementById('canvas-container').appendChild(renderer.domElement);
    canvasCtx = ui.outCanvas.getContext('2d');
    
    // 2. Klaviatura yaratish
    createKeyboard();
    
    // 3. 3D Cursor yaratish
    initCursor();
    updateLayout();

    // 4. MediaPipe yuklash
    if (typeof Hands === 'undefined') {
        alert("Internet xatosi: MediaPipe kutubxonasi yuklanmadi. Sahifani yangilang.");
        return;
    }

    hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);

    // 5. EVENT LISTENERS
    
    // Kamerani yoqish tugmasi
    if(ui.enableBtn) {
        ui.enableBtn.addEventListener('click', async () => {
            ui.enableBtn.innerText = "Yuklanmoqda...";
            audioCtx = new (window.AudioContext || window.webkitAudioContext)(); // AudioContext ni clickda yaratish muhim
            try {
                startAmbientMusic();
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
                ui.video.srcObject = stream;
                ui.video.onloadeddata = () => {
                    ui.permScreen.classList.add('fade-out');
                    setTimeout(() => {
                        ui.permScreen.classList.add('hidden');
                        ui.startScreen.classList.remove('hidden');
                        gameState = 'INTRO';
                        speak("Xush kelibsiz! Ismingizni kiriting.");
                    }, 500);
                    
                    ui.uiLayer.classList.remove('hidden');
                    updateLayout();
                    animate();
                };
            } catch(e) {
                alert("Kamera xatosi: " + e.message);
                ui.enableBtn.innerText = "Qayta urinish";
            }
        });
    }

    // Boshlash tugmasi
    if(ui.startBtn) {
        ui.startBtn.addEventListener('click', () => {
            const name = ui.nameInput.value.trim();
            if (!name) {
                ui.nameInput.style.borderColor = 'red';
                setTimeout(() => ui.nameInput.style.borderColor = '#00ffcc', 500);
                return;
            }
            playerName = name;
            ui.startScreen.classList.add('fade-out');
            setTimeout(() => {
                ui.startScreen.classList.add('hidden');
                initLevel(0); 
                startCountdown(false); 
            }, 500);
        });
    }

    // Qayta o'ynash tugmasi
    if(ui.restartBtn) {
        ui.restartBtn.addEventListener('click', () => {
            ui.winScreen.classList.add('hidden');
            state.levelIdx = 0;
            stopTimer();
            totalPlayedTime = 0;
            ui.timer.innerText = "00:00";
            ui.leaderboard.style.display = 'none';
            ui.restartBtn.style.display = 'none';
            initLevel(0);
            startCountdown(false); 
        });
    }

    // Ism kiritish validatsiyasi
    if(ui.nameInput) {
        ui.nameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        });
    }

    // Musiqa va Ovoz ikonkalari
    if(ui.musicIcon) ui.musicIcon.onclick = toggleMusic;
    if(ui.speechIcon) ui.speechIcon.onclick = toggleSpeech;

    window.addEventListener('resize', updateLayout);
});


// --- YORDAMCHI FUNKSIYALAR ---

function createKeyboard() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    ui.keyboard.innerHTML = '';
    chars.forEach(char => {
        const key = document.createElement('div');
        key.className = 'key interactive-ui';
        key.innerText = char;
        key.dataset.val = char;
        key.onclick = () => handleKeyClick(char);
        ui.keyboard.appendChild(key);
    });
    const back = document.createElement('div');
    back.className = 'key action-key interactive-ui';
    back.innerText = '⌫';
    back.dataset.val = 'BACK';
    back.onclick = () => handleKeyClick('BACK');
    ui.keyboard.appendChild(back);
}

function handleKeyClick(val) {
    let current = ui.nameInput.value;
    if (val === 'BACK') {
        ui.nameInput.value = current.slice(0, -1);
    } else if (current.length < 10) {
        ui.nameInput.value = current + val;
    }
    playSound('select');
}

function checkUiInteraction() {
    if (!state.handVisible) {
        ui.handCursor.style.display = 'none';
        return;
    }
    
    const sx = (1 - state.screenHandPos.x) * window.innerWidth;
    const sy = state.screenHandPos.y * window.innerHeight;
    
    ui.handCursor.style.display = 'block';
    ui.handCursor.style.left = sx + 'px';
    ui.handCursor.style.top = sy + 'px';

    if (state.gesture === 'PINCH') {
        ui.handCursor.classList.add('active');
        if (!isClickCooldown) {
            const el = document.elementFromPoint(sx, sy);
            if (el) {
                if (el.classList.contains('interactive-ui') || el.classList.contains('key')) {
                    el.classList.add('hovered');
                    if (el.dataset.val) { 
                        handleKeyClick(el.dataset.val);
                        el.classList.add('clicked');
                        setTimeout(() => el.classList.remove('clicked'), 150);
                    } else if (el.id === 'start-btn' || el.id === 'restart-btn' || el.id === 'enable-cam-btn' || el.id === 'music-icon' || el.id === 'speech-icon') {
                        el.click();
                    }
                    triggerCooldown();
                }
            }
        }
    } else {
        ui.handCursor.classList.remove('active');
        document.querySelectorAll('.hovered').forEach(el => el.classList.remove('hovered'));
    }
}

function triggerCooldown(ms = 400) {
    isClickCooldown = true;
    setTimeout(() => isClickCooldown = false, ms);
}

// --- TEXTURES ---
function createSlotTexture(text, name, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 600; 
    const ctx = canvas.getContext('2d');
    const centerX = 256; const centerY = 256; const radius = 200;
    const hex = '#' + new THREE.Color(colorHex).getHexString();
    
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
    ctx.strokeStyle = hex; ctx.lineWidth = 15;
    ctx.shadowColor = hex; ctx.shadowBlur = 30; 
    ctx.setLineDash([30, 20]); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;

    ctx.font = 'bold 200px "Segoe UI Emoji", Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.3; ctx.fillText(text, centerX, centerY + 20); ctx.globalAlpha = 1.0;
    
    let fontSize = 80; ctx.font = `bold ${fontSize}px "Fredoka One", sans-serif`;
    let textWidth = ctx.measureText(name).width; const maxWidth = 450;
    while (textWidth > maxWidth && fontSize > 20) {
        fontSize -= 5; ctx.font = `bold ${fontSize}px "Fredoka One", sans-serif`; textWidth = ctx.measureText(name).width;
    }
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 8;
    const textY = 560; ctx.strokeText(name, centerX, textY); ctx.fillText(name, centerX, textY);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function createPieceTexture(text, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const centerX = 128; const centerY = 128; const radius = 120;
    const hex = '#' + new THREE.Color(colorHex).getHexString();
    
    const grad = ctx.createRadialGradient(centerX,centerY,10, centerX,centerY,radius);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, hex); grad.addColorStop(1, '#000000');
    
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();
    
    ctx.font = 'bold 130px "Segoe UI Emoji", Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.shadowColor="rgba(0,0,0,0.5)"; ctx.shadowBlur=10;
    ctx.fillText(text, centerX, centerY + 10);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function initLevel(idx) {
    state.isTransitioning = true;
    slowMoFactor = 1.0; 
    
    while(piecesGroup.children.length) piecesGroup.remove(piecesGroup.children[0]);
    while(slotsGroup.children.length) slotsGroup.remove(slotsGroup.children[0]);
    
    state.levelIdx = idx;
    state.lockedCount = 0;
    const lvl = LEVELS[idx];
    
    ui.title.innerText = lvl.title;
    updateStepsUI();
    updateProgress(0); 
    speak(lvl.title + " bosqichi");

    const targetColor = new THREE.Color(lvl.color).lerp(new THREE.Color(0x000000), 0.7);
    scene.background = targetColor;
    scene.fog.color = targetColor;

    const isMobile = window.innerWidth < 600;
    const minDim = Math.min(state.worldSize.width, state.worldSize.height);
    let radius = minDim * 0.35; 
    if(radius < 2.5) radius = 2.5;

    const angleStep = (Math.PI * 2) / lvl.items.length;
    let positions = [];
    for(let i=0; i<lvl.items.length; i++) {
            let angle = i * angleStep;
            angle += (Math.random() - 0.5) * angleStep * 0.4;
            const r = radius + (Math.random() - 0.5) * 1.0;
            positions.push(new THREE.Vector3(Math.cos(angle)*r, Math.sin(angle)*r, 0));
    }
    
    // Shuffle
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    const slotScale = isMobile ? 0.8 : 1.0;

    lvl.items.forEach((item, i) => {
        const targetPos = positions[i];

        // SLOT
        const slotGeo = new THREE.PlaneGeometry(3.0, 3.5); 
        const slotTex = createSlotTexture(item.emoji, item.name, lvl.color);
        const slotMat = new THREE.MeshBasicMaterial({ map: slotTex, transparent: true, opacity: 1.0, alphaTest: 0.1 });
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.scale.setScalar(slotScale);
        slot.position.copy(targetPos);
        slot.position.y -= 0.26 * slotScale; 
        slot.position.z = -0.5; 
        slot.renderOrder = 1;
        slot.userData = { isSlot: true }; 
        slotsGroup.add(slot);

        // PIECE
        const pieceGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.2, 64);
        const pieceMatBody = new THREE.MeshStandardMaterial({ color: lvl.color, roughness: 0.2, metalness: 0.3 });
        const piece = new THREE.Mesh(pieceGeo, pieceMatBody);
        piece.scale.setScalar(slotScale);
        piece.rotation.x = Math.PI / 2;
        
        const faceGeo = new THREE.PlaneGeometry(2.0, 2.0);
        const faceTex = createPieceTexture(item.emoji, lvl.color);
        const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 });
        
        const frontFace = new THREE.Mesh(faceGeo, faceMat);
        frontFace.position.y = 0.12; frontFace.rotation.x = -Math.PI / 2; piece.add(frontFace);
        const backFace = new THREE.Mesh(faceGeo, faceMat);
        backFace.position.y = -0.12; backFace.rotation.x = Math.PI / 2; piece.add(backFace);
        
        const uniqueZ = 0.5 + (i * 0.1);
        const spread = isMobile ? 1.5 : 3.0;
        const velocity = new THREE.Vector3((Math.random()-0.5)*0.03, (Math.random()-0.5)*0.03, 0);

        piece.position.set((Math.random()-0.5)*spread*2, (Math.random()-0.5)*spread, uniqueZ);
        piece.renderOrder = 10 + i; 

        piece.userData = { 
            id: i, targetPos: targetPos, isLocked: false, floatOffset: Math.random() * 100,
            baseZ: uniqueZ, velocity: velocity,
            name: item.name 
        };
        piecesGroup.add(piece);
    });
    
    state.totalPieces = piecesGroup.children.length;
    state.isTransitioning = false;
}

// --- VISUAL EFFECTS ---
function createConfetti() {
    const count = 80; const geo = new THREE.BufferGeometry(); const posArr = new Float32Array(count*3); const velArr = [];
    for(let i=0; i<count; i++) {
        posArr[i*3] = (Math.random()-0.5)*2; posArr[i*3+1] = (Math.random()-0.5)*2; posArr[i*3+2] = 0;
        velArr.push({x: (Math.random()-0.5)*0.5, y: (Math.random()-0.5)*0.5+0.2, z: (Math.random()-0.5)*0.5});
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 });
    const sys = new THREE.Points(geo, mat); sys.userData = { vels: velArr, life: 100 }; particlesGroup.add(sys);
}
function updateParticles() {
    for(let i=particlesGroup.children.length-1; i>=0; i--) {
        const p = particlesGroup.children[i]; p.userData.life--;
        const pos = p.geometry.attributes.position.array;
        for(let j=0; j<p.userData.vels.length; j++) {
            pos[j*3] += p.userData.vels[j].x; pos[j*3+1] += p.userData.vels[j].y; pos[j*3+2] += p.userData.vels[j].z; p.userData.vels[j].y -= 0.01; 
        }
        p.geometry.attributes.position.needsUpdate = true; p.scale.setScalar(p.userData.life/100); if(p.userData.life<=0) particlesGroup.remove(p);
    }
}
function spawnTrail(pos) {
    if(Math.random() > 0.3) return;
    const el = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true }));
    el.position.copy(pos); el.position.z = 2.5; el.userData = { life: 20 }; trailsGroup.add(el);
}
function updateTrail() {
    for(let i=trailsGroup.children.length-1; i>=0; i--) {
        const t = trailsGroup.children[i]; t.userData.life--; t.material.opacity = t.userData.life/20; t.scale.setScalar(t.userData.life/20); if(t.userData.life<=0) trailsGroup.remove(t);
    }
}
function updateStepsUI() {
    ui.stepsContainer.innerHTML = '';
    LEVELS.forEach((lvl, idx) => {
        const dot = document.createElement('div'); dot.className = 'step-dot'; dot.innerText = idx + 1;
        if (idx < state.levelIdx) { dot.classList.add('completed'); dot.innerText = '✓'; } 
        else if (idx === state.levelIdx) { dot.classList.add('active'); }
        ui.stepsContainer.appendChild(dot);
    });
}
function updateProgress(percent) { ui.progressFill.style.width = percent + '%'; }

// --- LOGIC ---
function startTimer() { if (!isTimerRunning) { isTimerRunning = true; lastFrameTime = Date.now(); } }
function stopTimer() { isTimerRunning = false; }
function updateTimerDisplay() { 
    if (isTimerRunning) { 
        const now = Date.now(); totalPlayedTime += now - lastFrameTime; lastFrameTime = now; 
        ui.timer.innerText = formatTime(totalPlayedTime); 
    } 
}
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function showMessage(text, color) { ui.hintBubble.innerText = text; ui.hintBubble.style.color = color; ui.hintBubble.style.borderColor = color; ui.hintBubble.classList.add('visible'); }
function hideMessage() { ui.hintBubble.classList.remove('visible'); }

function playNote(freq, time) {
    if (!isMusicPlaying) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.1, time + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5); 
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(time); osc.stop(time + 1.5);
}
function scheduleMusic() {
    if (!isMusicPlaying) return;
    const currentTime = audioCtx.currentTime;
    while (nextNoteTime < currentTime + 0.1) {
        const freq = melody[Math.floor(Math.random() * melody.length)];
        playNote(freq, nextNoteTime); nextNoteTime += 0.4 + Math.random() * 0.4; 
    }
    requestAnimationFrame(scheduleMusic);
}
function startAmbientMusic() { if (isMusicPlaying) return; isMusicPlaying = true; if(audioCtx.state === 'suspended') audioCtx.resume(); nextNoteTime = audioCtx.currentTime + 0.1; scheduleMusic(); updateMusicIcon(); }
function toggleMusic() { 
    isMusicPlaying = !isMusicPlaying; 
    if (isMusicPlaying) { if(audioCtx.state === 'suspended') audioCtx.resume(); nextNoteTime = audioCtx.currentTime + 0.1; scheduleMusic(); } 
    updateMusicIcon(); 
}
function updateMusicIcon() {
    if (isMusicPlaying) { ui.musicIcon.innerText = '🔊'; ui.musicIcon.style.opacity = '1'; ui.musicIcon.style.borderColor = '#00ffcc'; }
    else { ui.musicIcon.innerText = '🔇'; ui.musicIcon.style.opacity = '0.6'; ui.musicIcon.style.borderColor = 'rgba(255,255,255,0.2)'; }
}

function speak(text) {
    if (!isSpeechEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'uz-UZ'; utterance.rate = 0.9; utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
}
function toggleSpeech() {
    isSpeechEnabled = !isSpeechEnabled;
    if(isSpeechEnabled) { ui.speechIcon.innerText = '🗣️'; ui.speechIcon.style.opacity = '1'; speak("Ovoz yoqildi"); }
    else { ui.speechIcon.innerText = '🔇'; ui.speechIcon.style.opacity = '0.6'; window.speechSynthesis.cancel(); }
}

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'select') { osc.frequency.setValueAtTime(600, now); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
    else if (type === 'pop') { osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now); gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5); osc.start(now); osc.stop(now + 0.5); }
    else if (type === 'count') { osc.type = 'square'; osc.frequency.setValueAtTime(440, now); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
    else if (type === 'win') { [440, 554, 659, 880].forEach((f, i) => { const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'triangle'; o.connect(g); g.connect(audioCtx.destination); o.frequency.value = f; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.1, now + 0.1 + i*0.1); g.gain.exponentialRampToValueAtTime(0.001, now + 3); o.start(now); o.stop(now + 3); }); }
}

function saveTime(name, timeMs) {
    let scores = JSON.parse(localStorage.getItem('kosmik_times') || '[]');
    const existingIndex = scores.findIndex(p => p.name === name);
    if (existingIndex !== -1) {
        if (timeMs < scores[existingIndex].time) {
            scores[existingIndex].time = timeMs;
            scores[existingIndex].date = new Date().toLocaleTimeString();
        }
    } else {
        scores.push({ name: name, time: timeMs, date: new Date().toLocaleTimeString() });
    }
    scores.sort((a, b) => a.time - b.time);
    scores = scores.slice(0, 10); 
    localStorage.setItem('kosmik_times', JSON.stringify(scores));
}

function showLeaderboard() {
    stopTimer();
    saveTime(playerName, totalPlayedTime);
    const scores = JSON.parse(localStorage.getItem('kosmik_times') || '[]');
    let html = '';
    scores.forEach((p, i) => {
        const isCurrent = (p.name === playerName);
        const cls = isCurrent ? 'lb-row lb-highlight' : 'lb-row';
        const icon = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : ''));
        html += `<div class="${cls}"><div class="lb-rank">${i+1} ${icon}</div><div class="lb-name">${p.name}</div><div class="lb-time">${formatTime(p.time)}</div></div>`;
    });
    ui.lbContent.innerHTML = html;
    ui.winScreen.classList.remove('hidden');
}

function startCountdown(isNextLevel = false) {
    let count = 3;
    ui.countdown.classList.remove('hidden');
    ui.countdown.style.opacity = 1;
    ui.countdown.innerText = count;
    playSound('count'); speak(count.toString());

    const interval = setInterval(() => {
        count--;
        if(count > 0) {
            ui.countdown.innerText = count; playSound('count'); speak(count.toString());
        } else {
            clearInterval(interval);
            ui.countdown.innerText = "KETDIK!";
            speak("Ketdik!");
            setTimeout(() => {
                ui.countdown.classList.add('hidden');
                if (isNextLevel) {
                    state.levelIdx++;
                    if(state.levelIdx >= LEVELS.length) state.levelIdx = 0;
                    initLevel(state.levelIdx);
                }
                gameState = 'PLAYING';
                startTimer(); 
            }, 1000);
        }
    }, 1000);
}

function onResults(results) {
    ui.outCanvas.width = ui.video.videoWidth;
    ui.outCanvas.height = ui.video.videoHeight;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, ui.outCanvas.width, ui.outCanvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, lm, {color: '#FF0000', lineWidth: 2, radius: 4});

        if(results.multiHandedness && results.multiHandedness.length > 0) state.handLabel = results.multiHandedness[0].label; 

        state.handVisible = true;
        const x = (1 - lm[9].x) * 2 - 1; 
        const y = (1 - lm[9].y) * 2 - 1;
        state.screenHandPos.x = 1 - lm[9].x; state.screenHandPos.y = lm[9].y;

        state.handPos.x += (x * CONFIG.sensitivityX - state.handPos.x) * 0.5;
        state.handPos.y += (y * CONFIG.sensitivityY - state.handPos.y) * 0.5;

        const thumb = lm[4];
        const index = lm[8];
        const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
        
        if (dist < 0.06) state.gesture = 'PINCH'; else state.gesture = 'IDLE';
    } else {
        state.handVisible = false;
    }
    canvasCtx.restore();
    isHandProcessing = false; 
}

function updateGame() {
    if(state.isTransitioning) return;
    updateParticles();
    updateTrail();
    updateTimerDisplay();

    if (gameState === 'INTRO' || !ui.winScreen.classList.contains('hidden')) {
        checkUiInteraction();
        return; 
    }

    const timeDelta = 0.002 * slowMoFactor;
    slotsGroup.children.forEach(slot => { if(slot.userData.isSlot) slot.rotation.z = Math.sin(Date.now()*0.001)*0.1; });

    piecesGroup.children.forEach(obj => {
        if(!obj.userData.isLocked && obj !== state.grabbedObj) {
            if (state.levelIdx >= 2) {
                const vel = obj.userData.velocity;
                obj.position.x += vel.x * slowMoFactor; obj.position.y += vel.y * slowMoFactor;
                const limitX = (state.worldSize.width/2)-1; const limitY = (state.worldSize.height/2)-1;
                if(obj.position.x>limitX||obj.position.x<-limitX) vel.x*=-1;
                if(obj.position.y>limitY||obj.position.y<-limitY) vel.y*=-1;
                obj.rotation.z+=0.01*slowMoFactor; obj.rotation.x+=0.01*slowMoFactor; obj.rotation.y+=0.01*slowMoFactor;
            } else {
                obj.position.y += Math.sin(Date.now()*0.002+obj.userData.floatOffset)*0.005*slowMoFactor;
                obj.rotation.z = Math.sin(Date.now()*0.001+obj.userData.floatOffset)*0.1*slowMoFactor;
            }
            obj.position.z = obj.userData.baseZ; 
        } else if (obj.userData.isLocked) {
            obj.rotation.z = Math.sin(Date.now()*0.002)*0.1; obj.rotation.x=Math.PI/2; obj.rotation.y=0;
        }
    });

    if (!state.handVisible) {
        if(cursorSprite) cursorSprite.visible = false;
        return;
    }

    mouse.x = Math.max(-1, Math.min(1, state.handPos.x));
    mouse.y = Math.max(-1, Math.min(1, state.handPos.y));
    
    raycaster.setFromCamera(mouse, camera);
    const targetZ = 0;
    const distZ = (targetZ - camera.position.z) / raycaster.ray.direction.z;
    const worldPos = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(distZ));
    
    if(cursorSprite) {
        cursorSprite.position.copy(worldPos); cursorSprite.position.z = 3; cursorSprite.visible = true;
        if (state.handLabel === 'Left') cursorSprite.scale.x = 1.5; else cursorSprite.scale.x = -1.5; 
        if (state.gesture === 'PINCH') cursorSprite.material.map = cursorSprite.userData.texPinch; else cursorSprite.material.map = cursorSprite.userData.texOpen;
        spawnTrail(cursorSprite.position);
    }

    if (state.gesture === 'PINCH') {
        showMessage("USHLANDI! (👌)", "#00ffcc");
        if (!state.grabbedObj && state.hoveredObj) {
            state.grabbedObj = state.hoveredObj;
            playSound('select');
        }
    } else {
        if (state.grabbedObj) {
            const obj = state.grabbedObj;
            const target = obj.userData.targetPos;
            const dist2D = Math.hypot(obj.position.x - target.x, obj.position.y - target.y);

            if (dist2D < CONFIG.snapDistance) {
                obj.position.copy(target);
                obj.position.z = 0.5; 
                obj.userData.isLocked = true;
                const light = new THREE.PointLight(0xffff00, 1, 5);
                obj.add(light);
                
                playSound('pop');
                speak("Ofarin! Bu " + obj.userData.name);
                createConfetti();
                
                state.lockedCount++;
                updateProgress((state.lockedCount / state.totalPieces) * 100);
                
                if (state.lockedCount === state.totalPieces) {
                    slowMoFactor = 0.2; 
                    setTimeout(() => {
                        slowMoFactor = 1.0;
                        playSound('win');
                        state.isTransitioning = true;
                        stopTimer(); 

                        if(state.levelIdx < LEVELS.length - 1) {
                             ui.winScreen.classList.remove('hidden');
                             ui.winScreen.querySelector('h1').innerText = "G'ALABA!";
                             ui.leaderboard.style.display = 'none';
                             ui.nextMsg.style.display = 'block';
                             ui.restartBtn.style.display = 'none';
                             speak("Barakalla! Keyingi bosqichga o'tamiz");
                             
                             setTimeout(() => {
                                ui.winScreen.classList.add('hidden');
                                startCountdown(true); 
                             }, 3000);
                        } else {
                            showLeaderboard();
                            ui.winScreen.querySelector('h1').innerText = "SUPER G'OLIB!";
                            ui.leaderboard.style.display = 'block';
                            ui.nextMsg.style.display = 'none';
                            ui.restartBtn.style.display = 'block';
                            speak("Tabriklayman! Siz g'olib bo'ldingiz!");
                        }
                    }, 800);
                }
            }
            state.grabbedObj = null;
        }
    }

    const intersects = raycaster.intersectObjects(piecesGroup.children);
    if (intersects.length > 0 && !state.grabbedObj) {
        const obj = intersects[0].object;
        const realObj = obj.parent.type === 'Group' ? obj : obj.parent;
        
        if (realObj && realObj.userData && !realObj.userData.isLocked) {
            state.hoveredObj = realObj;
            realObj.scale.setScalar(1.1 * (window.innerWidth < 768 ? 0.8 : 1.0)); 
            realObj.children.forEach(c => { if(c.material && c.material.emissive) c.material.emissive = new THREE.Color(0x333333); });
            if(state.gesture !== 'PINCH') { showMessage("CHIMCHILANG (👌)", "#ffff00"); }
        }
    } else {
        if (state.hoveredObj && state.hoveredObj !== state.grabbedObj) {
            state.hoveredObj.scale.setScalar(1.0 * (window.innerWidth < 768 ? 0.8 : 1.0)); 
            state.hoveredObj.children.forEach(c => { if(c.material && c.material.emissive) c.material.emissive = new THREE.Color(0x000000); });
        }
        state.hoveredObj = null;
        if(state.gesture !== 'PINCH') hideMessage();
    }

    if (state.grabbedObj) {
        state.grabbedObj.position.lerp(worldPos, 0.4);
        state.grabbedObj.position.z = 2; 
        state.grabbedObj.rotation.set(Math.PI / 2, 0, 0); 
        state.grabbedObj.scale.setScalar(1.2 * (window.innerWidth < 768 ? 0.8 : 1.0)); 
        const target = state.grabbedObj.userData.targetPos;
        const dist2D = Math.hypot(state.grabbedObj.position.x - target.x, state.grabbedObj.position.y - target.y);
        if (dist2D < CONFIG.snapDistance) {
            state.grabbedObj.position.x += (target.x - state.grabbedObj.position.x) * 0.2;
            state.grabbedObj.position.y += (target.y - state.grabbedObj.position.y) * 0.2;
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    if(!ui.video.paused && !isHandProcessing) {
        isHandProcessing = true;
        hands.send({image: ui.video});
    }
    updateGame();
    renderer.render(scene, camera);
}