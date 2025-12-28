/**
 * ==================== GALAKTIKA QAHRAMONI ====================
 * 3D Interaktiv O'yin - Qo'l Harakatlari Bilan Boshqarish
 * Author: AI Assistant
 * Version: 2.0
 * ============================================================
 */

'use strict';

// ==================== CONSTANTS ====================
const CONFIG = {
    CAMERA: {
        WIDTH: 640,
        HEIGHT: 480,
        FPS: 30
    },
    HAND_DETECTION: {
        MAX_HANDS: 1,
        MODEL_COMPLEXITY: 1,
        MIN_DETECTION_CONFIDENCE: 0.5,
        MIN_TRACKING_CONFIDENCE: 0.5
    },
    GAME: {
        QUIZ_QUESTIONS: 10,
        DRAG_DROP_TARGETS: 6,
        MOVEMENT_QUESTIONS: 5,
        INITIAL_LIVES: 3
    },
    SCORES: {
        QUIZ_CORRECT: 100,
        DRAG_DROP_CORRECT: 150,
        MOVEMENT_CORRECT: 120,
        GESTURE_BONUS: 50
    }
};

// ==================== GAME STATE ====================
const gameState = {
    currentScreen: 'loading',
    character: null,
    mission: null,
    score: 0,
    level: 1,
    lives: 3,
    currentQuestion: 0,
    correctAnswers: 0,
    totalQuestions: 10,
    isPlaying: false,
    isPaused: false
};

// ==================== THREE.JS VARIABLES ====================
let scene, camera, renderer;
let planets = [];
let selectedPlanet = null;
let animationId = null;

// ==================== HAND TRACKING VARIABLES ====================
let hands, cameraFeed, videoElement;
let currentGesture = null;
let previousGesture = null;
let handPosition = { x: 0, y: 0 };
let gestureConfidence = 0;
let isHandDetected = false;

// ==================== GAME ELEMENTS ====================
let draggedPlanet = null;
let dropZones = [];
let currentMovementQuestion = 0;
let questionTimer = null;

// ==================== QUIZ DATA ====================
const quizData = [
    { question: "Quyoshga eng yaqin sayyora qaysi?", answers: ["Merkuriy", "Venera", "Yer", "Mars"], correct: 0 },
    { question: "Eng katta sayyora qaysi?", answers: ["Saturn", "Yupiter", "Neptun", "Uran"], correct: 1 },
    { question: "Qizil sayyora deb qaysi sayyorani ataladi?", answers: ["Venera", "Mars", "Yupiter", "Saturn"], correct: 1 },
    { question: "Halqalari bor sayyora?", answers: ["Mars", "Yer", "Saturn", "Merkuriy"], correct: 2 },
    { question: "Biz qaysi sayyorada yashaymiz?", answers: ["Mars", "Venera", "Yer", "Yupiter"], correct: 2 },
    { question: "Quyoshdan eng uzoq sayyora?", answers: ["Uran", "Neptun", "Pluton", "Saturn"], correct: 1 },
    { question: "Eng issiq sayyora qaysi?", answers: ["Merkuriy", "Venera", "Mars", "Yer"], correct: 1 },
    { question: "Oy qaysi sayyoraning yo'ldoshi?", answers: ["Mars", "Yer", "Yupiter", "Saturn"], correct: 1 },
    { question: "Quyosh nima?", answers: ["Sayyora", "Yulduz", "Oy", "Asteroid"], correct: 1 },
    { question: "Quyosh sistemasida nechta sayyora bor?", answers: ["6 ta", "7 ta", "8 ta", "9 ta"], correct: 2 }
];

const movementData = [
    { question: "Qo'lingizni QUYOSH ustiga qo'ying", correct: "☀️", options: ["☀️", "🌙", "⭐", "🌍"] },
    { question: "Qo'lingizni YER ustiga qo'ying", correct: "🌍", options: ["🌍", "🔴", "🪐", "💍"] },
    { question: "Qo'lingizni MARS ustiga qo'ying", correct: "🔴", options: ["🔴", "🌍", "🪐", "🌙"] },
    { question: "Qo'lingizni OY ustiga qo'ying", correct: "🌙", options: ["🌙", "⭐", "☀️", "🌍"] },
    { question: "Qo'lingizni YUPITER ustiga qo'ying", correct: "🪐", options: ["🪐", "💍", "🔴", "🌍"] }
];

const planetConfig = [
    { color: 0xFFD700, size: 1.2, name: 'sun', emoji: '☀️' },
    { color: 0x87CEEB, size: 0.8, name: 'earth', emoji: '🌍' },
    { color: 0xFF6347, size: 0.6, name: 'mars', emoji: '🔴' },
    { color: 0xFFA500, size: 1.5, name: 'jupiter', emoji: '🪐' },
    { color: 0xF0E68C, size: 1.2, name: 'saturn', emoji: '💍' },
    { color: 0xC0C0C0, size: 0.5, name: 'moon', emoji: '🌙' }
];

// ==================== UTILITY FUNCTIONS ====================
const Utils = {
    // Show toast notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = { success: '✅', error: '❌', warning: '⚠️' };
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Play sound effect (placeholder)
    playSound(soundName) {
        // Sound implementation can be added here
        console.log(`Playing sound: ${soundName}`);
    },

    // Vibrate device (mobile)
    vibrate(pattern = 100) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },

    // Calculate distance between two points
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    },

    // Lerp (Linear Interpolation)
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    },

    // Clamp value between min and max
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
};

// ==================== THREE.JS INITIALIZATION ====================
const ThreeJS = {
    init() {
        // Scene setup
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0a0e27, 0.015);

        // Camera setup
        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 15);

        // Renderer setup
        renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('canvas3d'),
            antialias: true,
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Add stars
        this.createStars();
        
        // Add lighting
        this.createLights();
        
        // Create planets
        this.createPlanets();
        
        // Start animation
        this.animate();
    },

    createStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true
        });

        const starsVertices = [];
        for (let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 200;
            const y = (Math.random() - 0.5) * 200;
            const z = (Math.random() - 0.5) * 200;
            starsVertices.push(x, y, z);
        }

        starsGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(starsVertices, 3)
        );

        const stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);
    },

    createLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Point lights
        const pointLight1 = new THREE.PointLight(0x00ffff, 1, 100);
        pointLight1.position.set(10, 10, 10);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00ff, 1, 100);
        pointLight2.position.set(-10, -10, 10);
        scene.add(pointLight2);
    },

    createPlanets() {
        planetConfig.forEach((config, index) => {
            const geometry = new THREE.SphereGeometry(config.size, 32, 32);
            const material = new THREE.MeshPhongMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.9,
                shininess: 100,
                emissive: config.color,
                emissiveIntensity: 0.1
            });

            const planet = new THREE.Mesh(geometry, material);

            // Position planets in a circle
            const angle = (index / planetConfig.length) * Math.PI * 2;
            planet.position.x = Math.cos(angle) * 8;
            planet.position.y = Math.sin(angle) * 5;
            planet.position.z = -5;

            // Store planet data
            planet.userData = {
                name: config.name,
                emoji: config.emoji,
                rotationSpeed: 0.01 + Math.random() * 0.02,
                floatSpeed: 0.001 + Math.random() * 0.002,
                floatOffset: Math.random() * Math.PI * 2,
                originalPosition: planet.position.clone(),
                isDragging: false
            };

            scene.add(planet);
            planets.push(planet);
        });
    },

    animate() {
        animationId = requestAnimationFrame(() => ThreeJS.animate());

        // Animate planets
        planets.forEach(planet => {
            if (!planet.userData.isDragging) {
                // Rotation
                planet.rotation.y += planet.userData.rotationSpeed;

                // Floating animation
                const time = Date.now() * planet.userData.floatSpeed;
                planet.position.y += Math.sin(time + planet.userData.floatOffset) * 0.01;
            }

            // Highlight selected planet
            if (planet === selectedPlanet) {
                planet.scale.setScalar(1.4);
                planet.material.emissiveIntensity = 0.5;
            } else {
                planet.scale.setScalar(1);
                planet.material.emissiveIntensity = 0.1;
            }
        });

        // Smooth camera movement
        if (gameState.isPlaying) {
            camera.position.x += (Math.sin(Date.now() * 0.0001) * 0.5 - camera.position.x) * 0.01;
        }

        renderer.render(scene, camera);
    },

    selectNearestPlanet(x, y) {
        let nearest = null;
        let minDistance = Infinity;

        planets.forEach(planet => {
            const dist = Utils.distance(
                { x: planet.position.x, y: planet.position.y },
                { x, y }
            );

            if (dist < minDistance && dist < 6) {
                minDistance = dist;
                nearest = planet;
            }
        });

        if (nearest) {
            selectedPlanet = nearest;
            Utils.playSound('select');
            Utils.vibrate(50);
        }

        return nearest;
    },

    cleanup() {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        planets.forEach(planet => {
            scene.remove(planet);
            planet.geometry.dispose();
            planet.material.dispose();
        });
        
        planets = [];
    }
};

// ==================== HAND TRACKING ====================
const HandTracking = {
    async init() {
        try {
            videoElement = document.getElementById('video');

            // Initialize MediaPipe Hands
            hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions(CONFIG.HAND_DETECTION);
            hands.onResults(this.onResults.bind(this));

            // Get camera stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: CONFIG.CAMERA.WIDTH,
                    height: CONFIG.CAMERA.HEIGHT,
                    facingMode: 'user'
                }
            });

            videoElement.srcObject = stream;
            videoElement.style.display = 'block';

            // Initialize camera feed
            cameraFeed = new Camera(videoElement, {
                onFrame: async () => {
                    await hands.send({ image: videoElement });
                },
                width: CONFIG.CAMERA.WIDTH,
                height: CONFIG.CAMERA.HEIGHT
            });

            await cameraFeed.start();

            Utils.showToast('Kamera muvaffaqiyatli ulandi!', 'success');
            
            // Show gesture status
            document.getElementById('gestureStatus').classList.add('active');
            document.getElementById('handCursor').style.display = 'block';

        } catch (error) {
            console.error('Camera error:', error);
            Utils.showToast('Kamera ulanmadi. Tugmalar bilan o\'ynang.', 'error');
            
            // Fallback to touch/mouse controls
            this.initFallbackControls();
        }
    },

    onResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            isHandDetected = true;

            // Detect gesture
            const gesture = this.detectGesture(landmarks);
            
            // Update hand position
            const palm = landmarks[9];
            handPosition.x = palm.x * window.innerWidth;
            handPosition.y = palm.y * window.innerHeight;

            // Update cursor
            this.updateCursor();

            // Update gesture status
            this.updateGestureStatus(gesture);

            // Handle gesture
            this.handleGesture(gesture, landmarks);

            previousGesture = gesture;
        } else {
            isHandDetected = false;
            this.resetGesture();
        }
    },

    detectGesture(landmarks) {
        const thumb = landmarks[4];
        const index = landmarks[8];
        const middle = landmarks[12];
        const ring = landmarks[16];
        const pinky = landmarks[20];
        const wrist = landmarks[0];

        // Calculate distances
        const thumbIndexDist = Utils.distance(thumb, index);
        const indexWristDist = Utils.distance(index, wrist);

        // Pinch gesture
        if (thumbIndexDist < 0.05) {
            gestureConfidence = 0.9;
            return 'pinch';
        }

        // Thumbs up
        if (thumb.y < index.y && index.y > wrist.y && middle.y > wrist.y) {
            gestureConfidence = 0.85;
            return 'thumbsup';
        }

        // Fist
        if (indexWristDist < 0.2 && Utils.distance(middle, wrist) < 0.2) {
            gestureConfidence = 0.8;
            return 'fist';
        }

        // Open palm (default)
        gestureConfidence = 0.7;
        return 'open';
    },

    updateCursor() {
        const cursor = document.getElementById('handCursor');
        cursor.style.left = handPosition.x + 'px';
        cursor.style.top = handPosition.y + 'px';

        if (currentGesture === 'pinch') {
            cursor.classList.add('grabbing');
        } else {
            cursor.classList.remove('grabbing');
        }
    },

    updateGestureStatus(gesture) {
        const icons = {
            open: '👋',
            pinch: '🤏',
            thumbsup: '👍',
            fist: '✊'
        };

        const names = {
            open: 'Ochiq kaft',
            pinch: 'Qisish',
            thumbsup: 'Tasdiqlash',
            fist: 'Mushtlash'
        };

        document.getElementById('gestureIcon').textContent = icons[gesture] || '👋';
        document.getElementById('gestureName').textContent = names[gesture] || 'Noma\'lum';
        document.getElementById('confidenceBar').style.width = (gestureConfidence * 100) + '%';

        currentGesture = gesture;
    },

    resetGesture() {
        currentGesture = null;
        selectedPlanet = null;
        
        if (draggedPlanet) {
            draggedPlanet.userData.isDragging = false;
            draggedPlanet = null;
        }
    },

    handleGesture(gesture, landmarks) {
        const palm = landmarks[9];
        const x = (palm.x - 0.5) * 20;
        const y = -(palm.y - 0.5) * 15;

        // Handle based on current mission
        switch (gameState.mission) {
            case 'drag':
                this.handleDragGesture(gesture, x, y);
                break;
            case 'movement':
                this.handleMovementGesture();
                break;
        }
    },

    handleDragGesture(gesture, x, y) {
        // Select planet with open palm
        if (gesture === 'open' && previousGesture !== 'open' && !draggedPlanet) {
            ThreeJS.selectNearestPlanet(x, y);
        }
        
        // Drag with pinch
        else if (gesture === 'pinch' && selectedPlanet) {
            selectedPlanet.userData.isDragging = true;
            selectedPlanet.position.x = x;
            selectedPlanet.position.y = y;
            draggedPlanet = selectedPlanet;

            // Check drop zones
            GameModes.DragDrop.checkProximity();
        }
        
        // Release
        else if (gesture !== 'pinch' && draggedPlanet) {
            GameModes.DragDrop.handleDrop();
        }
    },

    handleMovementGesture() {
        const targets = document.querySelectorAll('.movement-target');
        
        targets.forEach(target => {
            const rect = target.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dist = Utils.distance(
                { x: handPosition.x, y: handPosition.y },
                { x: centerX, y: centerY }
            );
            
            if (dist < 80) {
                target.classList.add('highlight');
                
                if (currentGesture === 'pinch' && previousGesture !== 'pinch') {
                    GameModes.Movement.checkAnswer(target.dataset.option);
                }
            } else {
                target.classList.remove('highlight');
            }
        });
    },

    initFallbackControls() {
        // Mouse/Touch controls for non-camera users
        document.addEventListener('click', (e) => {
            handPosition.x = e.clientX;
            handPosition.y = e.clientY;
        });
    },

    stop() {
        if (cameraFeed) {
            cameraFeed.stop();
        }
        
        if (videoElement && videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
        }

        document.getElementById('video').style.display = 'none';
        document.getElementById('gestureStatus').classList.remove('active');
        document.getElementById('handCursor').style.display = 'none';
    }
};

// ==================== GAME MODES ====================
const GameModes = {
    Quiz: {
        start() {
            gameState.totalQuestions = CONFIG.GAME.QUIZ_QUESTIONS;
            document.getElementById('questionPanel').classList.add('active');
            this.showNextQuestion();
        },

        showNextQuestion() {
            if (gameState.currentQuestion >= gameState.totalQuestions) {
                Game.endGame();
                return;
            }

            const question = quizData[gameState.currentQuestion];
            
            document.getElementById('questionNumber').textContent = 
                `Savol ${gameState.currentQuestion + 1}/${gameState.totalQuestions}`;
            document.getElementById('questionText').textContent = question.question;

            const answersGrid = document.getElementById('answersGrid');
            answersGrid.innerHTML = '';

            question.answers.forEach((answer, index) => {
                const btn = document.createElement('button');
                btn.className = 'answer-button';
                btn.textContent = answer;
                btn.onclick = () => this.checkAnswer(index);
                answersGrid.appendChild(btn);
            });

            // Start timer (optional)
            this.startTimer();
        },

        checkAnswer(selectedIndex) {
            const question = quizData[gameState.currentQuestion];
            const buttons = document.querySelectorAll('.answer-button');
            
            // Disable all buttons
            buttons.forEach(btn => btn.style.pointerEvents = 'none');
            
            const isCorrect = selectedIndex === question.correct;
            
            // Visual feedback
            buttons[selectedIndex].classList.add(isCorrect ? 'correct' : 'wrong');
            if (!isCorrect) {
                buttons[question.correct].classList.add('correct');
            }

            // Update game state
            if (isCorrect) {
                gameState.score += CONFIG.SCORES.QUIZ_CORRECT;
                gameState.correctAnswers++;
                Utils.showToast('To\'g\'ri! +100 ball', 'success');
                Utils.playSound('correct');
                Utils.vibrate([50, 50, 50]);
            } else {
                gameState.lives--;
                Utils.showToast('Noto\'g\'ri javob!', 'error');
                Utils.playSound('wrong');
                Utils.vibrate(200);
            }

            UI.updateGameStats();

            // Next question or end game
            if (gameState.lives <= 0) {
                setTimeout(() => Game.endGame(), 1500);
            } else {
                setTimeout(() => {
                    gameState.currentQuestion++;
                    this.showNextQuestion();
                }, 1500);
            }
        },

        startTimer() {
            let timeLeft = 30;
            document.getElementById('timerText').textContent = `${timeLeft}s`;

            questionTimer = setInterval(() => {
                timeLeft--;
                document.getElementById('timerText').textContent = `${timeLeft}s`;

                if (timeLeft <= 0) {
                    clearInterval(questionTimer);
                    this.checkAnswer(-1); // Wrong answer
                }
            }, 1000);
        }
    },

    DragDrop: {
        start() {
            gameState.totalQuestions = CONFIG.GAME.DRAG_DROP_TARGETS;
            const targetsEl = document.getElementById('dragTargets');
            targetsEl.classList.add('active');
            dropZones = Array.from(document.querySelectorAll('.drop-zone'));
        },

        checkProximity() {
            dropZones.forEach(zone => {
                const rect = zone.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const dist = Utils.distance(
                    { x: handPosition.x, y: handPosition.y },
                    { x: centerX, y: centerY }
                );
                
                if (dist < 100 && !zone.classList.contains('filled')) {
                    zone.classList.add('active');
                } else {
                    zone.classList.remove('active');
                }
            });
        },

        handleDrop() {
            let dropped = false;

            dropZones.forEach(zone => {
                if (zone.classList.contains('active')) {
                    if (this.checkMatch(draggedPlanet, zone)) {
                        dropped = true;
                    }
                    zone.classList.remove('active');
                }
            });

            if (!dropped && draggedPlanet) {
                // Return to original position
                draggedPlanet.position.copy(draggedPlanet.userData.originalPosition);
            }

            draggedPlanet.userData.isDragging = false;
            draggedPlanet = null;
            selectedPlanet = null;
        },

        checkMatch(planet, zone) {
            if (planet.userData.name === zone.dataset.planet) {
                zone.classList.add('filled');
                zone.style.pointerEvents = 'none';
                
                gameState.score += CONFIG.SCORES.DRAG_DROP_CORRECT;
                gameState.correctAnswers++;
                gameState.currentQuestion++;
                
                Utils.showToast(`To'g'ri! ${planet.userData.emoji} +150 ball`, 'success');
                Utils.playSound('drop');
                Utils.vibrate([50, 50, 100]);
                
                UI.updateGameStats();
                
                if (gameState.currentQuestion >= gameState.totalQuestions) {
                    setTimeout(() => Game.endGame(), 1000);
                }
                
                return true;
            } else {
                gameState.lives--;
                Utils.showToast('Noto\'g\'ri joy!', 'error');
                Utils.playSound('wrong');
                Utils.vibrate(200);
                
                UI.updateGameStats();
                
                if (gameState.lives <= 0) {
                    setTimeout(() => Game.endGame(), 1000);
                }
                
                return false;
            }
        }
    },

    Movement: {
        start() {
            gameState.totalQuestions = CONFIG.GAME.MOVEMENT_QUESTIONS;
            currentMovementQuestion = 0;
            document.getElementById('movementGame').classList.add('active');
            this.showNextQuestion();
        },

        showNextQuestion() {
            if (currentMovementQuestion >= movementData.length) {
                Game.endGame();
                return;
            }

            const question = movementData[currentMovementQuestion];
            document.getElementById('movementInstruction').textContent = question.question;
            
            const optionsDiv = document.getElementById('movementOptions');
            optionsDiv.innerHTML = '';
            
            question.options.forEach(option => {
                const target = document.createElement('div');
                target.className = 'movement-target';
                target.textContent = option;
                target.dataset.option = option;
                optionsDiv.appendChild(target);
            });
        },

        checkAnswer(option) {
            const question = movementData[currentMovementQuestion];
            
            if (option === question.correct) {
                gameState.score += CONFIG.SCORES.MOVEMENT_CORRECT;
                gameState.correctAnswers++;
                currentMovementQuestion++;
                gameState.currentQuestion++;
                
                Utils.showToast(`To'g'ri! ${option} +120 ball`, 'success');
                Utils.playSound('correct');
                Utils.vibrate([50, 50, 50]);
                
                if (currentMovementQuestion >= movementData.length) {
                    setTimeout(() => Game.endGame(), 1000);
                } else {
                    setTimeout(() => this.showNextQuestion(), 1000);
                }
            } else {
                gameState.lives--;
                Utils.showToast('Noto\'g\'ri!', 'error');
                Utils.playSound('wrong');
                Utils.vibrate(200);
                
                if (gameState.lives <= 0) {
                    setTimeout(() => Game.endGame(), 1000);
                }
            }
            
            UI.updateGameStats();
        }
    }
};

// ==================== UI CONTROLLER ====================
const UI = {
    updateGameStats() {
        document.getElementById('scoreDisplay').textContent = gameState.score;
        document.getElementById('levelDisplay').textContent = gameState.level;
        document.getElementById('livesDisplay').textContent = gameState.lives;
        
        const progress = gameState.currentQuestion;
        const total = gameState.totalQuestions;
        const percent = (progress / total) * 100;
        
        document.getElementById('progressBar').style.width = percent + '%';
        document.querySelector('.progress-text').textContent = `${progress}/${total}`;
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        if (screenId) {
            const screen = document.getElementById(screenId);
            if (screen) {
                screen.classList.add('active');
                gameState.currentScreen = screenId.replace('Screen', '');
            }
        }
    },

    hideGameUI() {
        document.getElementById('gameUI').classList.remove('active');
        document.getElementById('questionPanel').classList.remove('active');
        document.getElementById('dragTargets').classList.remove('active');
        document.getElementById('movementGame').classList.remove('active');
    }
};

// ==================== GAME CONTROLLER ====================
const Game = {
     init() {
        // Initialize Three.js
        ThreeJS.init();
        
        // Simulate loading
        this.simulateLoading();
        
        // Add window resize handler
        window.addEventListener('resize', this.handleResize);
        
        // Add keyboard shortcuts
        this.addKeyboardShortcuts();
    },

    simulateLoading() {
        let progress = 0;
        const progressBar = document.getElementById('loadingProgress');
        
        const loadingInterval = setInterval(() => {
            progress += Math.random() * 15;
            
            if (progress >= 100) {
                progress = 100;
                clearInterval(loadingInterval);
                
                setTimeout(() => {
                    UI.showScreen('startScreen');
                }, 500);
            }
            
            progressBar.style.width = progress + '%';
        }, 200);
    },

    handleResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    },

    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC - Go back
            if (e.key === 'Escape') {
                if (gameState.isPlaying) {
                    this.exitGame();
                }
            }
            
            // Space - Pause (if playing)
            if (e.key === ' ' && gameState.isPlaying) {
                this.togglePause();
            }
        });
    },

    showStartScreen() {
        UI.showScreen('startScreen');
        UI.hideGameUI();
        HandTracking.stop();
        gameState.isPlaying = false;
    },

    showTutorial() {
        UI.showScreen('tutorialScreen');
        Utils.playSound('click');
    },

    showSettings() {
        Utils.showToast('Sozlamalar tez orada qo\'shiladi!', 'warning');
    },

    showCharacterSelect() {
        UI.showScreen('characterScreen');
        Utils.playSound('click');
    },

    selectCharacter(character) {
        gameState.character = character;
        
        // Update UI
        document.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        event.target.closest('.character-card').classList.add('selected');
        
        // Show continue button
        document.getElementById('continueButton').style.display = 'block';
        
        Utils.showToast(`${character === 'boy' ? 'Astronaut Bola' : character === 'girl' ? 'Astronaut Qiz' : character === 'robot' ? 'Robot Do\'st' : 'Do\'st Alien'} tanlandi!`, 'success');
        Utils.playSound('select');
        Utils.vibrate(50);
    },

    showMissionSelect() {
        if (!gameState.character) {
            Utils.showToast('Iltimos, avval qahramonni tanlang!', 'warning');
            this.showCharacterSelect();
            return;
        }
        
        UI.showScreen('missionScreen');
        Utils.playSound('click');
    },

    async startMission(missionType) {
        // Reset game state
        gameState.mission = missionType;
        gameState.score = 0;
        gameState.lives = CONFIG.GAME.INITIAL_LIVES;
        gameState.currentQuestion = 0;
        gameState.correctAnswers = 0;
        gameState.isPlaying = true;
        gameState.isPaused = false;
        currentMovementQuestion = 0;

        // Clear any existing timers
        if (questionTimer) {
            clearInterval(questionTimer);
        }

        // Reset planets
        planets.forEach(planet => {
            planet.position.copy(planet.userData.originalPosition);
            planet.userData.isDragging = false;
        });
        selectedPlanet = null;
        draggedPlanet = null;

        // Reset drop zones
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.remove('filled', 'active');
            zone.style.pointerEvents = 'auto';
        });

        // Show game UI
        UI.showScreen('');
        document.getElementById('gameUI').classList.add('active');
        UI.updateGameStats();

        // Initialize hand tracking
        await HandTracking.init();

        // Start specific game mode
        Utils.playSound('start');
        Utils.vibrate([100, 50, 100]);
        
        setTimeout(() => {
            switch (missionType) {
                case 'quiz':
                    GameModes.Quiz.start();
                    break;
                case 'drag':
                    GameModes.DragDrop.start();
                    break;
                case 'movement':
                    GameModes.Movement.start();
                    break;
            }
        }, 500);
    },

    togglePause() {
        gameState.isPaused = !gameState.isPaused;
        
        if (gameState.isPaused) {
            Utils.showToast('O\'yin to\'xtatildi', 'warning');
            if (questionTimer) clearInterval(questionTimer);
        } else {
            Utils.showToast('O\'yin davom ettirildi', 'success');
        }
    },

    exitGame() {
        const confirmed = confirm('O\'yindan chiqmoqchimisiz?');
        
        if (confirmed) {
            // Clear timers
            if (questionTimer) {
                clearInterval(questionTimer);
            }

            // Reset state
            gameState.isPlaying = false;
            gameState.isPaused = false;

            // Hide game elements
            UI.hideGameUI();
            document.getElementById('resultScreen').classList.remove('active');

            // Stop hand tracking
            HandTracking.stop();

            // Show mission select
            this.showMissionSelect();
            
            Utils.playSound('click');
        }
    },

    endGame() {
        gameState.isPlaying = false;
        
        // Clear timer
        if (questionTimer) {
            clearInterval(questionTimer);
        }

        // Hide game panels
        document.getElementById('questionPanel').classList.remove('active');
        document.getElementById('dragTargets').classList.remove('active');
        document.getElementById('movementGame').classList.remove('active');

        // Calculate results
        const accuracy = Math.round((gameState.correctAnswers / gameState.totalQuestions) * 100);
        let stars = 1;
        let title = 'Yaxshi harakat!';
        let icon = '👍';

        if (accuracy >= 90) {
            stars = 3;
            title = 'Mukammal!';
            icon = '🏆';
        } else if (accuracy >= 70) {
            stars = 2;
            title = 'Juda yaxshi!';
            icon = '🎉';
        } else if (accuracy >= 50) {
            stars = 1;
            title = 'Yaxshi!';
            icon = '😊';
        } else {
            stars = 0;
            title = 'Yana urinib ko\'ring!';
            icon = '💪';
        }

        // Update result screen
        document.getElementById('resultIcon').textContent = icon;
        document.getElementById('resultTitle').textContent = title;
        document.getElementById('resultStars').textContent = '⭐'.repeat(stars);
        document.getElementById('finalScore').textContent = gameState.score;
        document.getElementById('correctAnswers').textContent = 
            `${gameState.correctAnswers}/${gameState.totalQuestions}`;
        document.getElementById('accuracyPercent').textContent = accuracy + '%';

        // Show result screen
        document.getElementById('resultScreen').classList.add('active');

        // Play sound and vibrate
        Utils.playSound(stars >= 2 ? 'victory' : 'complete');
        Utils.vibrate(stars >= 2 ? [100, 50, 100, 50, 200] : [100, 100]);

        // Show appropriate toast
        if (stars >= 2) {
            Utils.showToast('Ajoyib natija! 🎉', 'success');
        }
    },

    restartMission() {
        document.getElementById('resultScreen').classList.remove('active');
        
        if (gameState.mission) {
            this.startMission(gameState.mission);
        }
        
        Utils.playSound('click');
    }
};

// ==================== INITIALIZE APPLICATION ====================
window.addEventListener('load', () => {
    Game.init();
});

// ==================== GLOBAL GAME OBJECT ====================
// Make game functions accessible from HTML
window.game = {
    showStartScreen: () => Game.showStartScreen(),
    showTutorial: () => Game.showTutorial(),
    showSettings: () => Game.showSettings(),
    showCharacterSelect: () => Game.showCharacterSelect(),
    selectCharacter: (char) => Game.selectCharacter(char),
    showMissionSelect: () => Game.showMissionSelect(),
    startMission: (type) => Game.startMission(type),
    exitGame: () => Game.exitGame(),
    restartMission: () => Game.restartMission()
};

// ==================== ERROR HANDLING ====================
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    Utils.showToast('Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.', 'error');
});

// ==================== PERFORMANCE MONITORING ====================
if ('performance' in window) {
    window.addEventListener('load', () => {
        const perfData = performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`📊 Sahifa yuklash vaqti: ${pageLoadTime}ms`);
    });
}

// ==================== SERVICE WORKER (PWA Support) ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Service worker can be added here for offline support
        console.log('✅ Service Worker qo\'llab-quvvatlanadi');
    });
}

// ==================== VISIBILITY CHANGE ====================
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState.isPlaying) {
        Game.togglePause();
    }
});

// ==================== CONSOLE STYLING ====================
console.log('%c🚀 Galaktika Qahramoni', 'color: #FFD700; font-size: 24px; font-weight: bold;');
console.log('%cVersion 2.0 - Clean Code Edition', 'color: #87CEEB; font-size: 14px;');
console.log('%cCreated with ❤️ by AI Assistant', 'color: #4CAF50; font-size: 12px;');

// ==================== DEBUG MODE ====================
const DEBUG = false;

if (DEBUG) {
    window.gameState = gameState;
    window.ThreeJS = ThreeJS;
    window.HandTracking = HandTracking;
    window.GameModes = GameModes;
    
    console.log('🔧 Debug mode enabled');
}

// ==================== HELPER FUNCTIONS FOR HTML ====================
function showScreen(screenId) {
    UI.showScreen(screenId);
}

function selectCharacter(character) {
    Game.selectCharacter(character);
}

function startMission(missionType) {
    Game.startMission(missionType);
}

// ==================== ANALYTICS (Optional) ====================
function trackEvent(eventName, eventData = {}) {
    // Analytics implementation can be added here
    if (DEBUG) {
        console.log('📈 Event tracked:', eventName, eventData);
    }
}

// Track game events
const originalStartMission = Game.startMission;
Game.startMission = function(type) {
    trackEvent('mission_started', { mission: type });
    return originalStartMission.call(this, type);
};

const originalEndGame = Game.endGame;
Game.endGame = function() {
    trackEvent('game_completed', {
        score: gameState.score,
        accuracy: Math.round((gameState.correctAnswers / gameState.totalQuestions) * 100),
        mission: gameState.mission
    });
    return originalEndGame.call(this);
};

// ==================== EXPORT FOR TESTING ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Game,
        GameModes,
        ThreeJS,
        HandTracking,
        Utils,
        UI
    };
}

console.log('✅ O\'yin muvaffaqiyatli yuklandi!');