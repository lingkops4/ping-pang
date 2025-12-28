// Simple Pong Game with Start Screen and WebAudio sound effects
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // DOM
  const leftScoreEl = document.getElementById('leftScore');
  const rightScoreEl = document.getElementById('rightScore');
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const aiSpeedInput = document.getElementById('aiSpeed');
  const aiSpeedLabel = document.getElementById('aiSpeedLabel');
  const volInput = document.getElementById('volume');
  const volLabel = document.getElementById('volLabel');

  // Canvas logical size
  const WIDTH = 800;
  const HEIGHT = 500;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  // Game state
  let leftScore = 0, rightScore = 0;
  let running = true;
  let gameState = 'menu'; // 'menu' | 'playing' | 'paused'

  // Paddles
  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = 100;
  const PADDLE_MARGIN = 20;
  const PADDLE_SPEED = 6;

  const leftPaddle = { x: PADDLE_MARGIN, y: (HEIGHT - PADDLE_HEIGHT) / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT };
  const rightPaddle = { x: WIDTH - PADDLE_MARGIN - PADDLE_WIDTH, y: (HEIGHT - PADDLE_HEIGHT) / 2, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, speed: Number(aiSpeedInput.value) };

  // Ball
  const BALL_RADIUS = 8;
  const INITIAL_BALL_SPEED = 5;
  const BALL_SPEED_INCREMENT = 0.3;
  const MAX_BALL_SPEED = 14;
  const ball = { x: WIDTH/2, y: HEIGHT/2, r: BALL_RADIUS, speed: INITIAL_BALL_SPEED, dx: 0, dy: 0 };

  // Input
  const keys = { ArrowUp: false, ArrowDown: false };

  // Audio (Web Audio API)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  let masterGain = null;
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new AudioCtx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = Number(volInput.value) / 100;
      masterGain.connect(audioCtx.destination);
    }
  }
  volInput.addEventListener('input', () => {
    volLabel.textContent = volInput.value + '%';
    if (masterGain) masterGain.gain.value = Number(volInput.value) / 100;
  });

  function playTone({freq=440, type='sine', dur=0.08, gain=0.15, decay=0.02, detune=0}) {
    ensureAudio();
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur + decay);
    o.connect(g);
    g.connect(masterGain);
    o.start(now);
    o.stop(now + dur + decay + 0.02);
  }

  function playPaddleHit() { playTone({freq: 900 + Math.random()*120, type: 'sawtooth', dur: 0.06, gain: 0.12}); }
  function playWallBounce() { playTone({freq: 420 + Math.random()*60, type: 'sine', dur: 0.05, gain: 0.08}); }
  function playScoreSound() {
    // descending sequence
    ensureAudio();
    const base = 880;
    playTone({freq: base, type:'sine', dur:0.12, gain:0.12});
    setTimeout(()=> playTone({freq: base*0.8, type:'sine', dur:0.12, gain:0.10}), 110);
    setTimeout(()=> playTone({freq: base*0.6, type:'sine', dur:0.16, gain:0.09}), 230);
  }
  function playStartSound() {
    ensureAudio();
    playTone({freq: 1200, type:'triangle', dur:0.06, gain:0.1});
    setTimeout(()=> playTone({freq: 1500, type:'triangle', dur:0.08, gain:0.12}), 80);
  }

  // Ball init
  function resetBall(servingTo = null) {
    ball.x = WIDTH/2; ball.y = HEIGHT/2; ball.speed = INITIAL_BALL_SPEED;
    const angleDeg = (Math.random() * 60 - 30);
    const angle = angleDeg * Math.PI / 180;
    const dir = servingTo === 'left' ? -1 : servingTo === 'right' ? 1 : (Math.random() < 0.5 ? -1 : 1);
    ball.dx = dir * ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
  }
  resetBall();

  // Input handling
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const mouseY = (e.clientY - rect.top) * scaleY;
    leftPaddle.y = clamp(mouseY - leftPaddle.height/2, 0, HEIGHT - leftPaddle.height);
  });
  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const touchY = (touch.clientY - rect.top) * scaleY;
    leftPaddle.y = clamp(touchY - leftPaddle.height/2, 0, HEIGHT - leftPaddle.height);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (gameState === 'playing') {
        gameState = (gameState === 'playing') ? 'paused' : 'playing';
      } else if (gameState === 'menu') {
        // start from menu if space pressed after focusing canvas
        startGame();
      } else if (gameState === 'paused') {
        gameState = 'playing';
      }
      e.preventDefault();
    } else if (e.key === 'r' || e.key === 'R') {
      leftScore = 0; rightScore = 0; updateScoreboard(); resetBall();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = false; e.preventDefault();
    }
  });

  // UI events
  aiSpeedInput.addEventListener('input', () => {
    aiSpeedLabel.textContent = aiSpeedInput.value;
    rightPaddle.speed = Number(aiSpeedInput.value);
  });
  volInput.addEventListener('input', () => {
    volLabel.textContent = volInput.value + '%';
    if (masterGain) masterGain.gain.value = Number(volInput.value) / 100;
  });

  startBtn.addEventListener('click', () => startGame());
  resetBtn.addEventListener('click', () => { leftScore = 0; rightScore = 0; updateScoreboard(); });

  function startGame() {
    startScreen.style.display = 'none';
    gameState = 'playing';
    rightPaddle.speed = Number(aiSpeedInput.value);
    playStartSound();
    // resume audio context on user gesture
    ensureAudio();
    resetBall();
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function update() {
    if (!running || gameState !== 'playing') return;

    // Keyboard control
    if (keys.ArrowUp) leftPaddle.y -= PADDLE_SPEED;
    if (keys.ArrowDown) leftPaddle.y += PADDLE_SPEED;
    leftPaddle.y = clamp(leftPaddle.y, 0, HEIGHT - leftPaddle.height);

    // AI
    const target = ball.y - rightPaddle.height / 2;
    const diff = target - rightPaddle.y;
    const aiStep = Math.sign(diff) * Math.min(rightPaddle.speed, Math.abs(diff));
    rightPaddle.y += aiStep;
    rightPaddle.y = clamp(rightPaddle.y, 0, HEIGHT - rightPaddle.height);

    // Move ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.dy = -ball.dy; playWallBounce(); }
    else if (ball.y + ball.r >= HEIGHT) { ball.y = HEIGHT - ball.r; ball.dy = -ball.dy; playWallBounce(); }

    // Paddle collision left
    if (ball.dx < 0 && ball.x - ball.r <= leftPaddle.x + leftPaddle.width) {
      if (ball.y + ball.r >= leftPaddle.y && ball.y - ball.r <= leftPaddle.y + leftPaddle.height) {
        ball.x = leftPaddle.x + leftPaddle.width + ball.r;
        reflectFromPaddle(leftPaddle);
        playPaddleHit();
      }
    }
    // Paddle collision right
    if (ball.dx > 0 && ball.x + ball.r >= rightPaddle.x) {
      if (ball.y + ball.r >= rightPaddle.y && ball.y - ball.r <= rightPaddle.y + rightPaddle.height) {
        ball.x = rightPaddle.x - ball.r;
        reflectFromPaddle(rightPaddle);
        playPaddleHit();
      }
    }

    // Score
    if (ball.x + ball.r < 0) {
      rightScore++; updateScoreboard(); resetBall('right'); playScoreSound(); flashScore('right');
    } else if (ball.x - ball.r > WIDTH) {
      leftScore++; updateScoreboard(); resetBall('left'); playScoreSound(); flashScore('left');
    }
  }

  // Visual flash when scoring
  let flashTimer = 0;
  function flashScore(side) {
    flashTimer = 18; // frames to flash
  }

  function reflectFromPaddle(paddle) {
    const paddleCenter = paddle.y + paddle.height / 2;
    const relativeIntersectY = (ball.y - paddleCenter) / (paddle.height / 2);
    const clampRel = clamp(relativeIntersectY, -1, 1);
    const maxBounceDeg = 65;
    const bounceAngle = clampRel * (maxBounceDeg * Math.PI / 180);

    ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + BALL_SPEED_INCREMENT);
    const dir = (paddle === leftPaddle) ? 1 : -1;
    ball.dx = dir * ball.speed * Math.cos(bounceAngle);
    ball.dy = ball.speed * Math.sin(bounceAngle);
  }

  function updateScoreboard() {
    leftScoreEl.textContent = leftScore;
    rightScoreEl.textContent = rightScore;
  }

  // Drawing
  function draw() {
    // Clear
    ctx.clearRect(0,0,WIDTH,HEIGHT);

    // Middle dashed line
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const dashH = 16, gap = 12;
    for (let y = 10; y < HEIGHT; y += dashH + gap) ctx.fillRect(WIDTH/2 - 2, y, 4, dashH);

    // Flash background on score briefly
    if (flashTimer > 0) {
      ctx.fillStyle = 'rgba(0,200,160,0.06)';
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      flashTimer--;
    }

    // Paddles
    ctx.fillStyle = '#e6f7ff';
    drawRoundedRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height, 4);
    drawRoundedRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height, 4);

    // Ball
    ctx.beginPath();
    ctx.fillStyle = '#00e6a8';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fill();

    // Paused HUD
    if (gameState === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(WIDTH/2 - 140, HEIGHT/2 - 36, 280, 72);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', WIDTH/2, HEIGHT/2 + 8);
      ctx.restore();
    }

    // If in menu state, show overlay (in case CSS hidden the element)
    if (gameState === 'menu') {
      startScreen.style.display = 'flex';
    }
  }

  function drawRoundedRect(x,y,w,h,r=6){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    ctx.fill();
  }

  // Loop
  function loop(){
    if (!running) return;
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Start the visual loop (menu will be visible until user starts)
  updateScoreboard();
  loop();

  // Expose minimal API
  window.pong = {
    stop: ()=>{ running=false; },
    resume: ()=>{ if (!running){ running=true; loop(); } },
    resetScores: ()=>{ leftScore=0; rightScore=0; updateScoreboard(); resetBall(); }
  };
})();