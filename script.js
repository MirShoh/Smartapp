// --- OVOZ TIZIMI ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMusicPlaying = false;
let nextNoteTime = 0;
let noteIndex = 0;

// --- O'YIN HOLATI (STATE) ---
let hands; 
let isHandProcessing = false; 
let playerName = "O'yinchi"; 

// Time Control
let totalPlayedTime = 0; 
let lastFrameTime = 0;
let isTimerRunning = false;
let slowMoFactor = 1.0;

const melody = [523.25, 659.25, 783.99, 1046.50, 523.25, 587.33, 783.99, 880.00];

// O'yin sozlamalari
const CONFIG = {
    smoothingSpeed: 0.3, 
    pinchThresholdStart: 0.05, 
    pinchThresholdEnd: 0.08,   
    snapDistance: 1.5,         
    magnetDistance: 3.0        
};

// Rasmlar yuklash uchun TextureLoader
const textureLoader = new THREE.TextureLoader();

// Bosqichlar va Fon rasmlari
const LEVELS = [
    { 
        title: "BOSHLANISH", 
        items: [{ emoji: "⭐", name: "YULDUZ" }], 
        color: 0x44aaff,
        bgUrl: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1600&auto=format&fit=crop' // Yulduzli osmon
    },
    { 
        title: "MEVALAR", 
        items: [{ emoji: "🍎", name: "OLMA" }, { emoji: "🍌", name: "BANAN" }], 
        color: 0xffaa00,
        bgUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=1600&auto=format&fit=crop' // Meva bog'i/Yorqin fon
    },
    { 
        title: "SHAKLLAR", 
        items: [{ emoji: "🟥", name: "KVADRAT" }, { emoji: "🔵", name: "DOIRA" }, { emoji: "🔺", name: "UCHBURCHAK" }], 
        color: 0xff0055,
        bgUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1600&auto=format&fit=crop' // Abstrakt geometriya
    },
    { 
        title: "KOSMOS", 
        items: [{ emoji: "🌍", name: "YER" }, { emoji: "🚀", name: "RAKETA" }, { emoji: "🛸", name: "UCHAR LAKOP" }, { emoji: "🪐", name: "SATURN" }], 
        color: 0x6a0dad,
        bgUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1600&auto=format&fit=crop' // Chuqur kosmos
    },
    { 
        title: "HAYVONOT BOG'I", 
        items: [{ emoji: "🦁", name: "SHER" }, { emoji: "🐼", name: "PANDA" }, { emoji: "🦊", name: "TULKI" }, { emoji: "🐘", name: "FIL" }, { emoji: "🐰", name: "QUYON" }], 
        color: 0x228B22,
        bgUrl: 'https://images.unsplash.com/photo-1598194451634-118c3937c568?q=80&w=1600&auto=format&fit=crop' // O'rmon/Tabiat
    }
];

const state = {
    levelIdx: 0,
    handPos: { x: 0, y: 0 },
    targetHandPos: { x: 0, y: 0 },
    gesture: 'IDLE',
    isPinching: false,
    handVisible: false,
    handLabel: 'Right',
    grabbedObj: null,
    hoveredObj: null,
    lockedCount: 0,
    totalPieces: 0,
    isTransitioning: false,
    worldSize: { width: 10, height: 10 }
};

const ui = {
    hintBubble: document.getElementById('hint-bubble'),
    startBtn: document.getElementById('start-btn'),
    nameInput: document.getElementById('player-name-input'),
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
    nextMsg: document.getElementById('next-level-msg')
};

const canvasCtx = ui.outCanvas.getContext('2d');

// --- THREE.JS SAHNASI ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0b2e);
scene.fog = new THREE.FogExp2(0x1a0b2e, 0.025);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.sortObjects = true; 
document.getElementById('canvas-container').appendChild(renderer.domElement);

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
const effectsGroup = new THREE.Group(); 
scene.add(piecesGroup);
scene.add(slotsGroup);
scene.add(particlesGroup);
scene.add(trailsGroup);
scene.add(effectsGroup);

let cursorSprite;
let texHandOpen, texHandPinch;

function initCursor() {
    texHandOpen = createCursorTexture('✋');
    texHandPinch = createCursorTexture('🤏'); 
    const cursorMat = new THREE.SpriteMaterial({ map: texHandOpen, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false });
    cursorSprite = new THREE.Sprite(cursorMat);
    cursorSprite.scale.set(1.5, 1.5, 1);
    cursorSprite.renderOrder = 999; 
    scene.add(cursorSprite);
}

// --- TIME & MUSIC ---
function startTimer() {
    if (!isTimerRunning) {
        isTimerRunning = true;
        lastFrameTime = Date.now();
    }
}

function stopTimer() {
    isTimerRunning = false;
}

function updateTimerDisplay() {
    if (isTimerRunning) {
        const now = Date.now();
        const delta = now - lastFrameTime;
        lastFrameTime = now;
        totalPlayedTime += delta; 
        ui.timer.innerText = formatTime(totalPlayedTime);
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function playNote(freq, time) {
    if (!isMusicPlaying) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; 
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.05); 
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5); 
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 1.5);
}

function scheduleMusic() {
    if (!isMusicPlaying) return;
    const tempo = 0.4; 
    const currentTime = audioCtx.currentTime;
    while (nextNoteTime < currentTime + 0.1) {
        const freq = melody[noteIndex];
        playNote(freq, nextNoteTime);
        if(Math.random() > 0.7) playNote(freq * 1.5, nextNoteTime); 
        nextNoteTime += tempo;
        noteIndex = (noteIndex + 1) % melody.length;
    }
    requestAnimationFrame(scheduleMusic);
}

function startAmbientMusic() {
    if (isMusicPlaying) return;
    isMusicPlaying = true;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    nextNoteTime = audioCtx.currentTime + 0.1;
    scheduleMusic();
    updateMusicIcon();
}

function toggleMusic() {
    isMusicPlaying = !isMusicPlaying;
    if (isMusicPlaying) {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        nextNoteTime = audioCtx.currentTime + 0.1;
        scheduleMusic();
    }
    updateMusicIcon();
}

function updateMusicIcon() {
    const icon = document.getElementById('music-icon');
    if (isMusicPlaying) {
        icon.innerText = '🔊';
        icon.style.opacity = '1';
        icon.style.borderColor = '#00ffcc';
    } else {
        icon.innerText = '🔇';
        icon.style.opacity = '0.6';
        icon.style.borderColor = 'rgba(255,255,255,0.2)';
    }
}

document.getElementById('music-icon').addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); toggleMusic();
});

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'select') { 
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'pop') { 
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'count') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'win') {
        [440, 554, 659, 880].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle';
            o.connect(g); g.connect(audioCtx.destination);
            o.frequency.value = f;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.1, now + 0.1 + i*0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + 3);
            o.start(now); o.stop(now + 3);
        });
    }
}

// --- TEXTURE CREATION ---
function createCursorTexture(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = '100px Arial';
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    ctx.shadowColor = "rgba(0,255,204,0.8)";
    ctx.shadowBlur = 15;
    ctx.fillText(emoji, 64, 70);
    return new THREE.CanvasTexture(canvas);
}

function createSlotTexture(text, name, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 600; 
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 600);

    const centerX = 256; const centerY = 256; const radius = 200;
    const hex = '#' + new THREE.Color(colorHex).getHexString();
    
    ctx.beginPath(); 
    ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,0.05)"; 
    ctx.fill();
    ctx.strokeStyle = hex; ctx.lineWidth = 15;
    ctx.shadowColor = hex; ctx.shadowBlur = 30; 
    ctx.setLineDash([30, 20]); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;

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
    ctx.clearRect(0, 0, 256, 256);
    const centerX = 128; const centerY = 128; const radius = 120;
    const hex = '#' + new THREE.Color(colorHex).getHexString();
    const grad = ctx.createRadialGradient(centerX,centerY,10, centerX,centerY,radius);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, hex); grad.addColorStop(1, '#000000');
    
    ctx.beginPath(); 
    ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.stroke();
    ctx.font = 'bold 130px "Segoe UI Emoji", Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.shadowColor="rgba(0,0,0,0.5)"; ctx.shadowBlur=10;
    ctx.fillText(text, centerX, centerY + 10);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- GAME LOGIC ---
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

function initLevel(idx) {
    state.isTransitioning = true;
    slowMoFactor = 1.0; 
    
    while(piecesGroup.children.length > 0) { piecesGroup.remove(piecesGroup.children[0]); }
    while(slotsGroup.children.length > 0) { slotsGroup.remove(slotsGroup.children[0]); }
    while(effectsGroup.children.length > 0) { effectsGroup.remove(effectsGroup.children[0]); }
    
    state.levelIdx = idx;
    state.lockedCount = 0;
    const lvl = LEVELS[idx];
    
    ui.title.innerText = lvl.title;
    updateStepsUI();
    updateProgress(0); 

    // FONNI O'ZGARTIRISH
    if (lvl.bgUrl) {
        textureLoader.load(lvl.bgUrl, (texture) => {
            scene.background = texture;
            scene.fog = new THREE.FogExp2(0x000000, 0.005); // Tuman kamroq bo'lsin rasm ko'rinishi uchun
        }, undefined, () => {
            // Agar rasm yuklanmasa, rang ishlatiladi
            const targetColor = new THREE.Color(lvl.color).lerp(new THREE.Color(0x000000), 0.7);
            scene.background = targetColor;
            scene.fog.color = targetColor;
        });
    } else {
        const targetColor = new THREE.Color(lvl.color).lerp(new THREE.Color(0x000000), 0.7);
        scene.background = targetColor;
        scene.fog.color = targetColor;
    }

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
    shuffleArray(positions); 

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
        slot.userData = { isSlot: true, baseScale: slotScale }; 
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
        
        // --- HITBOX QO'SHISH (Ko'rinmas ushlash sferasi) ---
        // Bu sfera shakl aylanib yupqa bo'lib qolganda ham uni ushlashga imkon beradi
        const hitGeo = new THREE.SphereGeometry(1.6, 16, 16); 
        const hitMat = new THREE.MeshBasicMaterial({ visible: false, color: 0xff0000, wireframe: true });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        piece.add(hitbox); // Shaklning ichiga joylaymiz
        
        const uniqueZ = 0.5 + (i * 0.1);
        const spread = isMobile ? 1.5 : 3.0;
        
        piece.position.set((Math.random()-0.5)*spread*2, (Math.random()-0.5)*spread, uniqueZ);
        piece.renderOrder = 10 + i; 

        piece.userData = { 
            id: i, targetPos: targetPos, isLocked: false, floatOffset: Math.random() * 100,
            baseZ: uniqueZ, velocity: new THREE.Vector3((Math.random()-0.5)*0.03, (Math.random()-0.5)*0.03, 0),
            name: item.name,
            originalScale: slotScale,
            hitbox: hitbox 
        };
        piecesGroup.add(piece);
    });
    
    state.totalPieces = piecesGroup.children.length;
    state.isTransitioning = false;
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
        html += `
            <div class="${cls}">
                <div class="lb-rank">${i+1} ${icon}</div>
                <div class="lb-name">${p.name}</div>
                <div class="lb-time">${formatTime(p.time)}</div>
            </div>`;
    });
    ui.lbContent.innerHTML = html;
    ui.winScreen.querySelector('h1').innerText = "NATIJALAR";
    ui.winScreen.classList.remove('hidden');
}

// --- HAND TRACKING & LOGIC ---
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

        const indexTip = lm[8];
        const thumbTip = lm[4];
        
        const midX = (indexTip.x + thumbTip.x) / 2;
        const midY = (indexTip.y + thumbTip.y) / 2;

        const rawX = (1 - midX) * 2 - 1; 
        const rawY = (1 - midY) * 2 - 1;

        state.targetHandPos.x = rawX * 3.0; 
        state.targetHandPos.y = rawY * 2.2;

        const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        
        if (dist < CONFIG.pinchThresholdStart && !state.isPinching) {
            state.isPinching = true;
            state.gesture = 'PINCH';
            ui.hintBubble.classList.add('pinch-active');
        } else if (dist > CONFIG.pinchThresholdEnd && state.isPinching) {
            state.isPinching = false;
            state.gesture = 'IDLE';
            ui.hintBubble.classList.remove('pinch-active');
        }

    } else {
        state.handVisible = false;
    }
    canvasCtx.restore();
    isHandProcessing = false; 
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let magnetLine = null;

function updateGame() {
    if(state.isTransitioning) return;
    updateParticles();
    updateTrail();
    updateTimerDisplay();

    state.handPos.x += (state.targetHandPos.x - state.handPos.x) * CONFIG.smoothingSpeed;
    state.handPos.y += (state.targetHandPos.y - state.handPos.y) * CONFIG.smoothingSpeed;

    const timeDelta = 0.002 * slowMoFactor;
    
    slotsGroup.children.forEach(slot => {
        if(slot.userData.isSlot) slot.rotation.z = Math.sin(Date.now() * 0.001) * 0.1; 
    });

    piecesGroup.children.forEach(obj => {
        if(!obj.userData.isLocked && obj !== state.grabbedObj) {
            if (state.levelIdx >= 2) {
                const vel = obj.userData.velocity;
                obj.position.x += vel.x * slowMoFactor;
                obj.position.y += vel.y * slowMoFactor;

                const limitX = (state.worldSize.width / 2) - 1;
                const limitY = (state.worldSize.height / 2) - 1;
                if (obj.position.x > limitX || obj.position.x < -limitX) vel.x *= -1;
                if (obj.position.y > limitY || obj.position.y < -limitY) vel.y *= -1;
                
                // Aylanish
                obj.rotation.z += 0.02 * slowMoFactor; 
                obj.rotation.x = Math.PI / 2; 
                obj.rotation.y = 0;
            } else {
                obj.position.y += Math.sin(Date.now() * 0.002 + obj.userData.floatOffset) * 0.005 * slowMoFactor;
                obj.rotation.z = Math.sin(Date.now() * 0.001 + obj.userData.floatOffset) * 0.1 * slowMoFactor;
            }
            obj.position.z = obj.userData.baseZ; 
        } else if (obj.userData.isLocked) {
            obj.rotation.z = Math.sin(Date.now() * 0.002) * 0.1; obj.rotation.x = Math.PI/2; obj.rotation.y = 0;
        }
    });

    if (!state.handVisible) {
        if(cursorSprite) cursorSprite.visible = false;
        return;
    }

    mouse.x = state.handPos.x / 3.0; 
    mouse.y = state.handPos.y / 2.2;
    
    raycaster.setFromCamera(mouse, camera);
    
    const targetZ = 0;
    const distZ = (targetZ - camera.position.z) / raycaster.ray.direction.z;
    const worldPos = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(distZ));
    
    if(cursorSprite) {
        cursorSprite.position.copy(worldPos);
        cursorSprite.position.z = 4; 
        cursorSprite.visible = true;
        if (state.handLabel === 'Left') cursorSprite.scale.x = 1.5; else cursorSprite.scale.x = -1.5; 
        if (state.gesture === 'PINCH') cursorSprite.material.map = texHandPinch; else cursorSprite.material.map = texHandOpen;
        spawnTrail(cursorSprite.position);
    }

    // --- GRAB LOGIC ---
    if (state.gesture === 'PINCH') {
        showMessage("USHLANDI! (🤏)", "#00ffcc");
        if (!state.grabbedObj && state.hoveredObj) {
            state.grabbedObj = state.hoveredObj;
            playSound('select');
        }
    } else {
        // RELEASE logic
        if (state.grabbedObj) {
            const obj = state.grabbedObj;
            const target = obj.userData.targetPos;
            const dist2D = Math.hypot(obj.position.x - target.x, obj.position.y - target.y);

            if (dist2D < CONFIG.snapDistance) {
                // MUVAFFAQIYATLI JOYLASHTIRISH
                obj.position.copy(target);
                // TUZATILDI: Ichiga to'liq sig'ishi uchun o'lchami kattalashtirildi (95%)
                obj.scale.setScalar(obj.userData.originalScale * 0.95); 
                obj.position.z = 0.0; // Uya bilan bir tekisda
                obj.userData.isLocked = true;
                
                const light = new THREE.PointLight(0xffff00, 1, 5);
                obj.add(light);
                
                playSound('pop');
                createConfetti();
                
                state.lockedCount++;
                updateProgress((state.lockedCount / state.totalPieces) * 100);
                
                if (state.lockedCount === state.totalPieces) {
                    playSound('slowmo');
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
                                setTimeout(() => {
                                ui.winScreen.classList.add('hidden');
                                startCountdown(true); 
                                }, 3000);
                        } else {
                            showLeaderboard();
                            ui.winScreen.classList.remove('hidden');
                            ui.winScreen.querySelector('h1').innerText = "SUPER G'OLIB!";
                            ui.leaderboard.style.display = 'block';
                            ui.nextMsg.style.display = 'none';
                            ui.restartBtn.style.display = 'block';
                        }
                    }, 800);
                }
            }
            state.grabbedObj = null;
            if(magnetLine) { effectsGroup.remove(magnetLine); magnetLine = null; }
        }
    }

    // RAYCASTING UPDATE: Endi Hitboxlarni ham tekshiradi
    const intersects = raycaster.intersectObjects(piecesGroup.children, true); // true = rekursiv (hitboxlarni ko'radi)
    if (intersects.length > 0 && !state.grabbedObj) {
        let obj = intersects[0].object;
        
        // Agar hitbox ushlangan bo'lsa, uning ota-onasini (asosiy shaklni) topamiz
        while (obj.parent && obj.parent !== piecesGroup) {
            obj = obj.parent;
        }

        if (obj && obj.userData && !obj.userData.isLocked) {
            state.hoveredObj = obj;
            obj.scale.setScalar(obj.userData.originalScale * 1.15); 
            obj.children.forEach(c => { 
                if(c.material && c.material.emissive) c.material.emissive = new THREE.Color(0x333333); 
            });
            if(state.gesture !== 'PINCH') { showMessage("CHIMCHILANG (🤏)", "#ffff00"); }
        }
    } else {
        if (state.hoveredObj && state.hoveredObj !== state.grabbedObj) {
            state.hoveredObj.scale.setScalar(state.hoveredObj.userData.originalScale); 
            state.hoveredObj.children.forEach(c => { 
                if(c.material && c.material.emissive) c.material.emissive = new THREE.Color(0x000000); 
            });
        }
        state.hoveredObj = null;
        if(state.gesture !== 'PINCH') hideMessage();
    }

    if (state.grabbedObj) {
        state.grabbedObj.position.lerp(worldPos, 0.25); 
        state.grabbedObj.position.z = 2; 
        
        state.grabbedObj.rotation.set(Math.PI / 2, 0, 0); 
        state.grabbedObj.scale.setScalar(state.grabbedObj.userData.originalScale * 1.2); 

        const target = state.grabbedObj.userData.targetPos;
        const dist2D = Math.hypot(state.grabbedObj.position.x - target.x, state.grabbedObj.position.y - target.y);
        
        if (dist2D < CONFIG.magnetDistance) {
            if(!magnetLine) {
                const geometry = new THREE.BufferGeometry().setFromPoints([state.grabbedObj.position, target]);
                const material = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.5 });
                magnetLine = new THREE.Line(geometry, material);
                effectsGroup.add(magnetLine);
            } else {
                const positions = magnetLine.geometry.attributes.position.array;
                positions[0] = state.grabbedObj.position.x;
                positions[1] = state.grabbedObj.position.y;
                positions[2] = state.grabbedObj.position.z;
                positions[3] = target.x;
                positions[4] = target.y;
                positions[5] = target.z;
                magnetLine.geometry.attributes.position.needsUpdate = true;
            }
            if(dist2D < CONFIG.snapDistance * 1.2) {
                state.grabbedObj.position.lerp(target, 0.1);
            }
        } else {
            if(magnetLine) { effectsGroup.remove(magnetLine); magnetLine = null; }
        }
    }
}

function showMessage(text, color) {
    ui.hintBubble.innerText = text;
    ui.hintBubble.style.color = color;
    ui.hintBubble.style.borderColor = color;
    ui.hintBubble.classList.add('visible');
}

function hideMessage() {
    ui.hintBubble.classList.remove('visible');
}

function startCountdown(isNextLevel = false) {
    let count = 3;
    ui.countdown.classList.remove('hidden');
    ui.countdown.style.opacity = 1;
    ui.countdown.innerText = count;
    playSound('count');

    const interval = setInterval(() => {
        count--;
        if(count > 0) {
            ui.countdown.innerText = count;
            playSound('count');
        } else {
            clearInterval(interval);
            ui.countdown.innerText = "KETDIK! 🚀";
            setTimeout(() => {
                ui.countdown.classList.add('hidden');
                if (isNextLevel) {
                    state.levelIdx++;
                    if(state.levelIdx >= LEVELS.length) state.levelIdx = 0;
                    initLevel(state.levelIdx);
                }
                startTimer(); 
            }, 1000);
        }
    }, 1000);
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

window.addEventListener('load', () => {
    if (typeof Hands === 'undefined') {
        alert("Xatolik: MediaPipe yuklanmadi. Internetni tekshiring.");
        ui.loading.innerHTML = "Xatolik ❌";
        return;
    }

    hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);

    ui.loading.style.display = 'none';
    ui.startBtn.classList.remove('hidden');
    ui.nameInput.style.display = 'block'; 
    
    initCursor();
    updateLayout(); 
    updateStepsUI();
});

ui.startBtn.addEventListener('click', async () => {
    const name = ui.nameInput.value.trim();
    if (!name) {
        ui.nameInput.style.borderColor = 'red';
        ui.nameInput.placeholder = "Ism kiritish shart!";
        return;
    }
    playerName = name;
    ui.nameInput.style.display = 'none'; 
    ui.startBtn.innerText = "Yuklanmoqda...";

    try {
        startAmbientMusic();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
        ui.video.srcObject = stream;
        ui.video.onloadeddata = () => {
            ui.startScreen.classList.add('fade-out');
            setTimeout(() => {
                ui.startScreen.classList.add('hidden');
                initLevel(0); 
                startCountdown(false); 
            }, 500);
            ui.uiLayer.classList.remove('hidden');
            updateLayout();
            animate();
        };
    } catch(e) {
        alert("Kamera xatosi: " + e.message);
        ui.startBtn.innerText = "Kameraga ruxsat bering";
    }
});

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

window.addEventListener('resize', () => {
    updateLayout();
});