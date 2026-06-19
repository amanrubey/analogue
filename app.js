(() => {
  'use strict';

  const CENTER = 200;
  const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * 204;

  const hourHand = document.getElementById('hour-hand');
  const minuteHand = document.getElementById('minute-hand');
  const secondHand = document.getElementById('second-hand');
  const digitalTime = document.getElementById('digital-time');
  const modeLabel = document.getElementById('mode-label');
  const timerPanel = document.getElementById('timer-panel');
  const timerComplete = document.getElementById('timer-complete');
  const progressFill = document.getElementById('progress-fill');
  const segmentedControl = document.querySelector('.segmented-control');

  const inputHours = document.getElementById('timer-hours');
  const inputMinutes = document.getElementById('timer-minutes');
  const inputSeconds = document.getElementById('timer-seconds');

  const btnStart = document.getElementById('timer-start');
  const btnPause = document.getElementById('timer-pause');
  const btnReset = document.getElementById('timer-reset');
  const btnDismiss = document.getElementById('dismiss-complete');

  const modeButtons = document.querySelectorAll('.segment');

  let mode = 'clock';
  let timerTotalMs = 0;
  let timerRemainingMs = 0;
  let timerEndAt = null;
  let timerRunning = false;
  let timerPausedRemaining = 0;
  let audioCtx = null;

  progressFill.style.strokeDasharray = PROGRESS_CIRCUMFERENCE;
  progressFill.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE;

  function buildClockFace() {
    const hourMarkers = document.getElementById('hour-markers');
    const minuteTicks = document.getElementById('minute-ticks');
    const numerals = document.getElementById('numerals');

    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * (Math.PI / 180);
      const inner = 168;
      const outer = 178;
      const x1 = CENTER + inner * Math.cos(angle);
      const y1 = CENTER + inner * Math.sin(angle);
      const x2 = CENTER + outer * Math.cos(angle);
      const y2 = CENTER + outer * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke-width', i % 3 === 0 ? '2.5' : '2');
      hourMarkers.appendChild(line);

      const numAngle = (i * 30 - 90) * (Math.PI / 180);
      const num = i === 0 ? 12 : i;
      const nx = CENTER + 148 * Math.cos(numAngle);
      const ny = CENTER + 148 * Math.sin(numAngle);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', nx);
      text.setAttribute('y', ny);
      text.textContent = num;
      numerals.appendChild(text);
    }

    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const angle = (i * 6 - 90) * (Math.PI / 180);
      const inner = 172;
      const outer = 176;
      const x1 = CENTER + inner * Math.cos(angle);
      const y1 = CENTER + inner * Math.sin(angle);
      const x2 = CENTER + outer * Math.cos(angle);
      const y2 = CENTER + outer * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      minuteTicks.appendChild(line);
    }
  }

  function setHandRotation(group, degrees) {
    group.setAttribute('transform', `rotate(${degrees} ${CENTER} ${CENTER})`);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDigital(h, m, s) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function getClockAngles(date) {
    const ms = date.getMilliseconds();
    const s = date.getSeconds() + ms / 1000;
    const m = date.getMinutes() + s / 60;
    const h = (date.getHours() % 12) + m / 60;

    return {
      hour: h * 30,
      minute: m * 6,
      second: s * 6,
    };
  }

  function getTimerAngles(remainingMs) {
    const totalSec = remainingMs / 1000;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    return {
      hour: (h % 12 + m / 60) * 30,
      minute: (m + s / 60) * 6,
      second: s * 6,
      h,
      m,
      s: Math.floor(s),
    };
  }

  function updateHands(angles) {
    setHandRotation(hourHand, angles.hour);
    setHandRotation(minuteHand, angles.minute);
    setHandRotation(secondHand, angles.second);
  }

  function updateProgress() {
    if (mode !== 'timer' || timerTotalMs <= 0) {
      progressFill.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE;
      return;
    }
    const ratio = timerRemainingMs / timerTotalMs;
    progressFill.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE * (1 - ratio);
  }

  function clampInput(input, min, max) {
    let val = parseInt(input.value, 10);
    if (Number.isNaN(val) || val < min) val = min;
    if (val > max) val = max;
    input.value = val;
    return val;
  }

  function getTimerDurationMs() {
    const h = clampInput(inputHours, 0, 23);
    const m = clampInput(inputMinutes, 0, 59);
    const s = clampInput(inputSeconds, 0, 59);
    return (h * 3600 + m * 60 + s) * 1000;
  }

  function setInputsFromMs(ms) {
    const totalSec = Math.ceil(ms / 1000);
    inputHours.value = Math.floor(totalSec / 3600);
    inputMinutes.value = Math.floor((totalSec % 3600) / 60);
    inputSeconds.value = totalSec % 60;
  }

  function setInputsDisabled(disabled) {
    [inputHours, inputMinutes, inputSeconds].forEach((el) => {
      el.disabled = disabled;
    });
    document.querySelectorAll('.picker-btn').forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  function playChime() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      [880, 880].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = audioCtx.currentTime + i * 0.5;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch {
      /* audio unavailable */
    }
  }

  function showComplete() {
    timerComplete.classList.remove('hidden');
    document.body.classList.remove('timer-running', 'timer-low');
    playChime();
  }

  function hideComplete() {
    timerComplete.classList.add('hidden');
  }

  function updateTimerUI() {
    const low = timerRemainingMs > 0 && timerRemainingMs <= 10000;
    document.body.classList.toggle('timer-low', timerRunning && low);
    document.body.classList.toggle('timer-running', timerRunning);
    updateProgress();
  }

  function tick() {
    if (mode === 'clock') {
      const now = new Date();
      const angles = getClockAngles(now);
      updateHands(angles);
      digitalTime.textContent = formatDigital(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      );
    } else if (mode === 'timer') {
      if (timerRunning && timerEndAt !== null) {
        timerRemainingMs = Math.max(0, timerEndAt - performance.now());

        if (timerRemainingMs <= 0) {
          timerRunning = false;
          timerEndAt = null;
          timerRemainingMs = 0;
          setInputsDisabled(false);
          btnStart.disabled = false;
          btnPause.disabled = true;
          updateTimerUI();
          showComplete();
        }
      }

      const angles = getTimerAngles(timerRemainingMs);
      updateHands(angles);
      digitalTime.textContent = formatDigital(angles.h, angles.m, angles.s);
      updateTimerUI();
    }

    requestAnimationFrame(tick);
  }

  function setMode(newMode) {
    if (newMode === mode) return;

    if (timerRunning) pauseTimer();

    mode = newMode;

    modeButtons.forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    });

    segmentedControl.dataset.active = mode === 'timer' ? 'timer' : 'clock';
    document.body.classList.toggle('timer-mode', mode === 'timer');

    if (mode === 'clock') {
      timerPanel.classList.add('hidden');
      modeLabel.textContent = 'Local Time';
      document.body.classList.remove('timer-running', 'timer-low');
      progressFill.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE;
    } else {
      timerPanel.classList.remove('hidden');
      modeLabel.textContent = timerRunning ? 'Timer' : 'Set Timer';
      timerRemainingMs = getTimerDurationMs();
      timerTotalMs = timerRemainingMs;
      updateProgress();
    }
  }

  function startTimer() {
    const duration = getTimerDurationMs();
    if (duration <= 0) return;

    if (!timerRunning) {
      if (timerPausedRemaining > 0) {
        timerRemainingMs = timerPausedRemaining;
        timerPausedRemaining = 0;
      } else {
        timerRemainingMs = duration;
        timerTotalMs = duration;
      }
      timerEndAt = performance.now() + timerRemainingMs;
      timerRunning = true;
    }

    setInputsDisabled(true);
    btnStart.disabled = true;
    btnPause.disabled = false;
    modeLabel.textContent = 'Timer';
    hideComplete();
  }

  function pauseTimer() {
    if (!timerRunning) return;

    timerPausedRemaining = Math.max(0, timerEndAt - performance.now());
    timerRemainingMs = timerPausedRemaining;
    timerRunning = false;
    timerEndAt = null;

    setInputsDisabled(false);
    setInputsFromMs(timerRemainingMs);
    btnStart.disabled = false;
    btnPause.disabled = true;
    modeLabel.textContent = 'Paused';
    document.body.classList.remove('timer-running', 'timer-low');
  }

  function resetTimer() {
    timerRunning = false;
    timerEndAt = null;
    timerPausedRemaining = 0;
    timerRemainingMs = getTimerDurationMs();
    timerTotalMs = timerRemainingMs;

    setInputsDisabled(false);
    btnStart.disabled = false;
    btnPause.disabled = true;
    modeLabel.textContent = 'Set Timer';
    document.body.classList.remove('timer-running', 'timer-low');
    hideComplete();
    updateProgress();
  }

  function bindEvents() {
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    document.querySelectorAll('.picker-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (timerRunning) return;
        const input = document.getElementById(btn.dataset.target);
        const max = parseInt(input.max, 10);
        const min = parseInt(input.min, 10);
        let val = parseInt(input.value, 10) + parseInt(btn.dataset.delta, 10);
        if (val < min) val = max;
        if (val > max) val = min;
        input.value = val;
        timerRemainingMs = getTimerDurationMs();
        timerTotalMs = timerRemainingMs;
        updateProgress();
      });
    });

    [inputHours, inputMinutes, inputSeconds].forEach((input) => {
      input.addEventListener('change', () => {
        if (!timerRunning) {
          timerRemainingMs = getTimerDurationMs();
          timerTotalMs = timerRemainingMs;
          updateProgress();
        }
      });
    });

    btnStart.addEventListener('click', startTimer);
    btnPause.addEventListener('click', pauseTimer);
    btnReset.addEventListener('click', resetTimer);
    btnDismiss.addEventListener('click', hideComplete);

    timerComplete.querySelector('.sheet-backdrop').addEventListener('click', hideComplete);
  }

  buildClockFace();
  bindEvents();
  timerRemainingMs = getTimerDurationMs();
  timerTotalMs = timerRemainingMs;
  requestAnimationFrame(tick);
})();
