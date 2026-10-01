'use strict';

const $ = (id) => document.getElementById(id);
const { sample, positionBounds, niceStep, quantities, calculatorMethods, calculate, calculationMotion } = window.MotionPhysics;
const state = { mode: 'mru', position: 0, velocity: 8, acceleration: 1.5, duration: 12, time: 0, playing: false, speed: 1, graph: 'position', compare: false };
const colors = { blue: '#2563eb', ink: '#263b56', muted: '#94a1bf', orange: '#c79561', grid: '#eaf0fa' };
let frameId = null;
let lastFrame = null;
let wheelAngle = 0;

function format(value, digits = 2) {
  if (value !== 0 && Math.abs(value) < Math.pow(10, -digits)) {
    return Number(value.toPrecision(4)).toString();
  }
  return (Object.is(value, -0) ? 0 : value).toFixed(digits);
}

function axisFormat(value, step) {
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  return digits > 6 || Math.abs(value) >= 1e7 ? Number(value.toPrecision(4)).toString() : value.toFixed(digits);
}

function rangeProgress(input) {
  const span = Number(input.max) - Number(input.min);
  const ratio = span === 0 ? 0 : (Number(input.value) - Number(input.min)) / span;
  input.style.setProperty('--progress', `${ratio * 100}%`);
}

function pause() {
  state.playing = false;
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  lastFrame = null;
}

function reset() {
  pause();
  state.time = 0;
  wheelAngle = 0;
  render();
}

function syncControls() {
  for (const key of ['position', 'velocity', 'acceleration']) {
    const value = key === 'acceleration' && state.mode === 'mru' ? 0 : state[key];
    const limit = { position: 100, velocity: 20, acceleration: 5 }[key];
    const range = $(`${key}-range`);
    range.min = Math.min(-limit, value);
    range.max = Math.max(limit, value);
    range.step = 'any';
    $(`${key}-number`).value = value;
    range.value = value;
    rangeProgress(range);
    const labels = range.parentElement.querySelectorAll('.range-labels span');
    const unit = { position: 'm', velocity: 'm/s', acceleration: 'm/s²' }[key];
    labels[0].textContent = `${resultNumber(Number(range.min))} ${unit}`;
    labels[1].textContent = `${resultNumber(Number(range.max))} ${unit}`;
  }
  $('duration').value = state.duration;
  $('timeline').max = state.duration;
  $('timeline').step = 'any';
  $('timeline').disabled = state.duration === 0;
  $('play').disabled = state.duration === 0;
  $('step').disabled = state.duration === 0;
  $('duration-value').textContent = state.duration;
  const isMRU = state.mode === 'mru';
  for (const mode of ['mru', 'mruv']) {
    $(`mode-${mode}`).classList.toggle('active', state.mode === mode);
    $(`mode-${mode}`).setAttribute('aria-pressed', String(state.mode === mode));
  }
  $('acceleration-number').disabled = isMRU;
  $('acceleration-range').disabled = isMRU;
  $('acceleration-parameter').classList.toggle('locked', isMRU);
  $('locked-note').hidden = !isMRU;
  $('mode-description').textContent = isMRU
    ? 'Sin prisa ni pausa: la velocidad no cambia con el tiempo.'
    : 'Un cambio constante: la aceleración modifica la velocidad cada segundo.';
  $('compare').disabled = isMRU;
  $('compare').checked = state.compare;
  $('compare-label').classList.toggle('disabled', isMRU);
  syncCalculator();
}

function setMode(mode) {
  detachCalculation();
  state.mode = mode;
  if (mode === 'mru') state.compare = false;
  syncControls();
  reset();
}

for (const mode of ['mru', 'mruv']) $(`mode-${mode}`).addEventListener('click', () => setMode(mode));

const calculatorValues = {};
let calculatorMode = null;
let plottedCalculation = null;

function resultNumber(value) {
  return new Intl.NumberFormat('es', { maximumSignificantDigits: 10 }).format(value);
}

function clearCalculatorResult() {
  const method = calculatorMethods[state.mode].find((item) => item.id === $('calc-method').value);
  $('calculator-result').classList.remove('error');
  $('calc-result-label').textContent = 'TU RESULTADO';
  $('calc-result-value').textContent = '—';
  $('calc-formula').textContent = method.formula;
  $('calc-substitution').textContent = 'Introduce los datos y pulsa «Calcular resultado».';
  $('calc-result-note').textContent = '';
  plottedCalculation = null;
  $('calc-solution-label').hidden = true;
  $('graph-source').textContent = 'Pulsa «Calcular resultado» para actualizar la gráfica. Se conserva el último movimiento representado.';
}

function detachCalculation() {
  plottedCalculation = null;
  $('calc-solution-label').hidden = true;
  $('graph-source').textContent = 'Experimento manual: pulsa «Calcular resultado» para volver a representar los datos de arriba.';
}

function setGraph(key) {
  state.graph = key;
  document.querySelectorAll('[data-graph]').forEach((tab) => {
    const active = tab.dataset.graph === key;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
}

function applyCalculation(index) {
  if (!plottedCalculation) return;
  const { result, motions } = plottedCalculation;
  const motion = motions[index];
  pause();
  Object.assign(state, motion, { time: result.target === 'initialVelocity' ? 0 : motion.duration, compare: false });
  wheelAngle = (sample(state, state.time).position - state.position) * 0.32;
  setGraph(['velocity', 'initialVelocity', 'finalVelocity'].includes(result.target) ? 'velocity' : result.target === 'acceleration' ? 'acceleration' : 'position');
  syncControls();
  $('calc-solution').value = String(index);
  const origin = `x₀ = ${resultNumber(motion.position)} m`;
  const time = motion.timeDetermined ? `t = ${resultNumber(motion.duration)} s` : 'Tiempo no determinado; intervalo mostrado: 12 s';
  $('graph-source').textContent = `Datos de la calculadora · ${origin} · v₀ = ${resultNumber(motion.velocity)} m/s · a = ${resultNumber(motion.acceleration)} m/s² · ${time}.${motion.duration === 0 ? ' Solo se representa el instante inicial.' : ''}`;
  render();
}

$('calc-solution').addEventListener('change', () => applyCalculation(Number($('calc-solution').value)));

function buildCalculatorFields() {
  const method = calculatorMethods[state.mode].find((item) => item.id === $('calc-method').value);
  $('calculator-fields').replaceChildren();
  for (const field of method.fields) {
    const quantity = quantities[field];
    const label = document.createElement('label');
    label.htmlFor = `calc-${field}`;
    label.textContent = `${quantity.label} (${quantity.symbol})`;
    const wrap = document.createElement('div');
    wrap.className = 'calculator-input';
    const input = document.createElement('input');
    input.id = `calc-${field}`;
    input.name = field;
    input.type = 'number';
    input.step = 'any';
    input.required = true;
    input.placeholder = 'Introduce un valor';
    if (field === 'time') input.min = '0';
    input.value = calculatorValues[field] ?? '';
    input.addEventListener('input', () => {
      calculatorValues[field] = input.value;
      input.removeAttribute('aria-invalid');
      clearCalculatorResult();
    });
    const unit = document.createElement('span');
    unit.textContent = quantity.unit;
    wrap.append(input, unit);
    label.append(wrap);
    $('calculator-fields').append(label);
  }
  clearCalculatorResult();
}

function buildCalculatorMethods() {
  $('calc-method').replaceChildren();
  for (const method of calculatorMethods[state.mode].filter((item) => item.target === $('calc-target').value)) {
    const label = method.fields.map((field) => quantities[field].symbol).join(', ');
    $('calc-method').add(new Option(`Con ${label}`, method.id));
  }
  buildCalculatorFields();
}

function syncCalculator() {
  for (const mode of ['mru', 'mruv']) {
    $(`calc-mode-${mode}`).classList.toggle('active', state.mode === mode);
    $(`calc-mode-${mode}`).setAttribute('aria-pressed', String(state.mode === mode));
  }
  if (calculatorMode === state.mode) return;
  calculatorMode = state.mode;
  $('calc-target').replaceChildren();
  for (const target of new Set(calculatorMethods[state.mode].map((method) => method.target))) {
    const quantity = quantities[target];
    $('calc-target').add(new Option(`${quantity.label} (${quantity.symbol})`, target));
  }
  buildCalculatorMethods();
}

for (const mode of ['mru', 'mruv']) $(`calc-mode-${mode}`).addEventListener('click', () => setMode(mode));
$('calc-target').addEventListener('change', buildCalculatorMethods);
$('calc-method').addEventListener('change', buildCalculatorFields);
$('calculator-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const method = calculatorMethods[state.mode].find((item) => item.id === $('calc-method').value);
  const values = {};
  let invalidInput = null;
  for (const field of method.fields) {
    const input = $(`calc-${field}`);
    values[field] = input.value.trim() === '' ? NaN : Number(input.value);
    const invalid = !Number.isFinite(values[field]) || (field === 'time' && values[field] < 0);
    input.setAttribute('aria-invalid', String(invalid));
    if (invalid && !invalidInput) invalidInput = input;
  }
  try {
    const result = calculate(state.mode, method.id, values);
    const motions = result.results.map((_, index) => calculationMotion(state.mode, method.id, values, index));
    const quantity = quantities[result.target];
    $('calculator-result').classList.remove('error');
    $('calc-result-label').textContent = `${quantity.label.toUpperCase()} · ${state.mode.toUpperCase()}`;
    $('calc-result-value').textContent = result.results.map((value) => `${resultNumber(value)} ${quantity.unit}`).join(' o ');
    $('calc-formula').textContent = result.formula;
    const symbols = Object.fromEntries(method.fields.map((field) => [quantities[field].symbol, `(${resultNumber(values[field])})`]));
    $('calc-substitution').textContent = 'Sustitución: ' + result.formula.replace(/v₀|vƒ|x₀|xƒ|d|v|a|t/g, (symbol) => symbols[symbol] ?? symbol);
    $('calc-result-note').textContent = result.results.length > 1
      ? result.target === 'time' ? 'Hay dos instantes válidos: el objeto pasa por ese desplazamiento dos veces.' : 'Hay dos velocidades posibles en instantes distintos. Elige según el sentido del movimiento.'
      : result.target === 'distance' ? 'Este resultado es el desplazamiento con signo, no necesariamente la distancia total recorrida.' : 'Resultado en unidades del Sistema Internacional.';
    plottedCalculation = { result, motions };
    $('calc-solution').replaceChildren();
    result.results.forEach((value, index) => {
      const time = result.target === 'time' ? '' : ` · t = ${resultNumber(motions[index].duration)} s`;
      $('calc-solution').add(new Option(`${quantity.symbol} = ${resultNumber(value)} ${quantity.unit}${time}`, String(index)));
    });
    $('calc-solution-label').hidden = result.results.length < 2;
    const longestIndex = motions.reduce((best, motion, index) => motion.duration > motions[best].duration ? index : best, 0);
    applyCalculation(longestIndex);
  } catch (error) {
    plottedCalculation = null;
    $('calc-solution-label').hidden = true;
    $('graph-source').textContent = 'Cálculo no válido: la gráfica conserva el último movimiento. Revisa los datos y vuelve a calcular.';
    $('calculator-result').classList.add('error');
    $('calc-result-label').textContent = 'REVISA TUS DATOS';
    $('calc-result-value').textContent = '—';
    $('calc-substitution').textContent = error.message;
    $('calc-result-note').textContent = '';
    if (invalidInput) invalidInput.focus();
  }
});

for (const key of ['position', 'velocity', 'acceleration']) {
  const number = $(`${key}-number`);
  const range = $(`${key}-range`);
  const update = (input) => {
    if (input.value.trim() === '' || !Number.isFinite(Number(input.value))) {
      input.value = state[key];
      return;
    }
    state[key] = Number(input.value);
    detachCalculation();
    syncControls();
    reset();
  };
  number.addEventListener('change', () => update(number));
  range.addEventListener('input', () => update(range));
}

$('duration').addEventListener('change', () => {
  const value = Number($('duration').value);
  if ($('duration').value.trim() && Number.isFinite(value) && value >= 0) {
    state.duration = value;
    detachCalculation();
  }
  syncControls();
  reset();
});

const presets = {
  cruise: { mode: 'mru', position: 0, velocity: 8, acceleration: 1.5, duration: 12 },
  accelerate: { mode: 'mruv', position: 0, velocity: 0, acceleration: 1.5, duration: 12 },
  brake: { mode: 'mruv', position: 0, velocity: 12, acceleration: -2, duration: 12 },
};

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    detachCalculation();
    Object.assign(state, presets[button.dataset.preset], { compare: false });
    syncControls();
    reset();
  });
});

function tick(timestamp) {
  if (!state.playing) return;
  if (lastFrame !== null) {
    const delta = Math.min((timestamp - lastFrame) / 1000, 0.1) * state.speed;
    const before = sample(state, state.time).position;
    state.time = Math.min(state.duration, state.time + delta);
    wheelAngle += (sample(state, state.time).position - before) * 0.32;
  }
  lastFrame = timestamp;
  if (state.time >= state.duration) pause();
  render();
  if (state.playing) frameId = requestAnimationFrame(tick);
}

function togglePlay() {
  if (state.duration === 0) return;
  if (state.playing) {
    pause();
    render();
  } else {
    if (state.time >= state.duration) state.time = 0;
    state.playing = true;
    lastFrame = null;
    render();
    frameId = requestAnimationFrame(tick);
  }
}

$('play').addEventListener('click', togglePlay);
$('reset').addEventListener('click', reset);
$('step').addEventListener('click', () => {
  pause();
  state.time = Math.min(state.duration, Math.round((state.time + 0.1) * 100) / 100);
  wheelAngle = (sample(state, state.time).position - state.position) * 0.32;
  render();
});
$('timeline').addEventListener('input', () => {
  pause();
  state.time = Number($('timeline').value);
  wheelAngle = (sample(state, state.time).position - state.position) * 0.32;
  render();
});
$('speed').addEventListener('change', () => { state.speed = Number($('speed').value); });
$('compare').addEventListener('change', () => { state.compare = $('compare').checked; render(); });
document.querySelectorAll('[data-graph]').forEach((button) => {
  button.addEventListener('click', () => {
    setGraph(button.dataset.graph);
    render();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || /INPUT|SELECT|BUTTON|TEXTAREA|A/.test(event.target.tagName)) return;
  event.preventDefault();
  togglePlay();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.playing) { pause(); render(); }
});

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = rect.width;
  const height = rect.height;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function roundedRect(ctx, x, y, width, height, radius, color) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fillStyle = color; ctx.fill();
}

function drawCar(ctx, x, y, direction, ghost = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  if (ghost) ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#244f8f15';
  ctx.beginPath(); ctx.ellipse(0, 5, 42, 6, 0, 0, Math.PI * 2); ctx.fill();
  roundedRect(ctx, -40, -28, 79, 25, 7, '#2563eb');
  ctx.beginPath(); ctx.moveTo(-24, -27); ctx.lineTo(-15, -44); ctx.quadraticCurveTo(-13, -48, -8, -48); ctx.lineTo(12, -48); ctx.quadraticCurveTo(16, -47, 19, -42); ctx.lineTo(28, -27); ctx.closePath(); ctx.fillStyle = '#3b82f6'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-16, -29); ctx.lineTo(-9, -42); ctx.lineTo(0, -42); ctx.lineTo(0, -29); ctx.closePath(); ctx.fillStyle = '#bfd5f2'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -42); ctx.lineTo(13, -42); ctx.lineTo(21, -29); ctx.lineTo(5, -29); ctx.closePath(); ctx.fillStyle = '#d9e4fb'; ctx.fill();
  line(ctx, 3, -26, 3, -10, '#ffffff24');
  roundedRect(ctx, -7, -24, 7, 2, 1, '#8ebfff');
  roundedRect(ctx, 32, -24, 6, 5, 2, '#f5ddb0');
  roundedRect(ctx, -39, -24, 4, 5, 1, '#dc9d71');
  roundedRect(ctx, -42, -9, 7, 4, 2, '#a7bfdc');
  roundedRect(ctx, 34, -9, 7, 4, 2, '#a7bfdc');
  for (const wx of [-24, 24]) {
    ctx.beginPath(); ctx.arc(wx, -5, 10, 0, Math.PI * 2); ctx.fillStyle = '#283c57'; ctx.fill();
    ctx.beginPath(); ctx.arc(wx, -5, 5.5, 0, Math.PI * 2); ctx.fillStyle = '#aabfd0'; ctx.fill();
    const angle = ghost ? 0 : wheelAngle;
    line(ctx, wx - Math.cos(angle) * 4, -5 - Math.sin(angle) * 4, wx + Math.cos(angle) * 4, -5 + Math.sin(angle) * 4, '#647e91', 1.5);
  }
  ctx.restore();
}

function drawScene() {
  const { ctx, width, height } = canvasContext($('scene'));
  if (!width || !height) return;
  const bounds = positionBounds(state);
  const span = Math.max(bounds.max - bounds.min, 20);
  const worldMin = bounds.min - span * 0.14;
  const worldMax = bounds.max + span * 0.14;
  const margin = width < 450 ? 52 : 66;
  const toX = (position) => margin + (position - worldMin) / (worldMax - worldMin) * (width - margin * 2);
  const roadY = height * 0.65;
  const current = sample(state, state.time);

  // A quiet landscape gives a stationary frame of reference.
  ctx.fillStyle = '#e7effc';
  ctx.beginPath(); ctx.moveTo(0, roadY - 22);
  ctx.bezierCurveTo(width * 0.2, roadY - 70, width * 0.28, roadY - 24, width * 0.48, roadY - 35);
  ctx.bezierCurveTo(width * 0.67, roadY - 59, width * 0.8, roadY - 51, width, roadY - 26);
  ctx.lineTo(width, roadY + 18); ctx.lineTo(0, roadY + 18); ctx.fill();
  ctx.fillStyle = '#f0f5fc';
  ctx.beginPath(); ctx.moveTo(0, roadY - 6);
  ctx.bezierCurveTo(width * 0.35, roadY - 35, width * 0.63, roadY - 12, width, roadY - 23);
  ctx.lineTo(width, roadY + 18); ctx.lineTo(0, roadY + 18); ctx.fill();

  for (const fraction of [0.12, 0.81, 0.9]) {
    const tx = width * fraction;
    line(ctx, tx, roadY - 7, tx, roadY - 34, '#bccbe2', 2);
    ctx.fillStyle = '#dce7f3'; ctx.beginPath(); ctx.ellipse(tx, roadY - 40, 9, 15, 0, 0, Math.PI * 2); ctx.fill();
  }
  roundedRect(ctx, 0, roadY + 8, width, 25, 0, '#e8edf6');
  line(ctx, 0, roadY + 8, width, roadY + 8, '#c4d0e4');
  ctx.setLineDash([11, 12]); line(ctx, 0, roadY + 21, width, roadY + 21, '#c4cee4'); ctx.setLineDash([]);

  const initialX = toX(state.position);
  const carX = toX(current.position);
  const direction = current.velocity < -0.001 ? -1 : current.velocity > 0.001 ? 1 : state.acceleration < 0 && state.mode === 'mruv' ? -1 : 1;
  if (Math.abs(carX - initialX) > 55) drawCar(ctx, initialX, roadY, state.velocity < 0 ? -1 : 1, true);
  line(ctx, initialX, roadY + 43, carX, roadY + 43, '#80aaf0', 2);
  ctx.beginPath(); ctx.arc(initialX, roadY + 43, 3, 0, Math.PI * 2); ctx.fillStyle = '#80aaf0'; ctx.fill();
  drawCar(ctx, carX, roadY, direction);

  // A signed velocity arrow: the length represents speed, not acceleration.
  if (Math.abs(current.velocity) > 0.02) {
    const arrowWidth = Math.min(52, 14 + Math.abs(current.velocity) * 1.3);
    const arrowStart = carX - direction * arrowWidth / 2;
    const arrowEnd = carX + direction * arrowWidth / 2;
    const arrowY = roadY - 61;
    line(ctx, arrowStart, arrowY, arrowEnd, arrowY, colors.blue, 1.5);
    line(ctx, arrowEnd, arrowY, arrowEnd - direction * 5, arrowY - 3, colors.blue, 1.5);
    line(ctx, arrowEnd, arrowY, arrowEnd - direction * 5, arrowY + 3, colors.blue, 1.5);
    ctx.font = '9px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = colors.blue;
    ctx.fillText(`v = ${format(current.velocity, 1)} m/s`, carX, arrowY - 9);
  }

  const rulerY = roadY + 54;
  line(ctx, 18, rulerY, width - 18, rulerY, '#d6dfee');
  const step = niceStep(worldMax - worldMin, width < 450 ? 4 : 7);
  ctx.font = '9px "DM Sans", sans-serif'; ctx.textAlign = 'center';
  for (let value = Math.ceil(worldMin / step) * step; value <= worldMax + step * 0.001; value += step) {
    const x = toX(value);
    line(ctx, x, rulerY, x, rulerY + 5, '#b9c8e0');
    ctx.fillStyle = '#8d9eb5'; ctx.fillText(axisFormat(value, step), x, rulerY + 18);
  }
  ctx.fillStyle = '#91a1b6'; ctx.textAlign = 'right'; ctx.fillText('x (m)', width - 15, rulerY + 18);
  line(ctx, carX, roadY + 39, carX, rulerY, colors.blue, 1.5);
  ctx.beginPath(); ctx.arc(carX, rulerY, 3.5, 0, Math.PI * 2); ctx.fillStyle = colors.blue; ctx.fill();
  $('scene').setAttribute('aria-label', `Vehículo en la posición ${format(current.position)} metros, con velocidad ${format(current.velocity)} metros por segundo, en t = ${format(state.time)} segundos.`);
}

function drawChart() {
  const { ctx, width, height } = canvasContext($('chart'));
  if (!width || !height) return;
  const key = state.graph;
  const quantities = { position: { name: 'Posición', symbol: 'x', unit: 'm' }, velocity: { name: 'Velocidad', symbol: 'v', unit: 'm/s' }, acceleration: { name: 'Aceleración', symbol: 'a', unit: 'm/s²' } };
  const quantity = quantities[key];
  const reference = { ...state, mode: 'mru' };
  const compare = state.compare && state.mode === 'mruv';
  const points = [];
  for (let i = 0; i <= 160; i++) points.push(sample(state, state.duration * i / 160)[key]);
  if (key === 'position') { const bounds = positionBounds(state); points.push(bounds.min, bounds.max); }
  if (compare) points.push(sample(reference, 0)[key], sample(reference, state.duration)[key]);
  let min = Math.min(0, ...points);
  let max = Math.max(0, ...points);
  const padding = Math.max((max - min) * 0.16, key === 'position' ? 2 : 0.5);
  min -= padding; max += padding;
  const plot = { left: 48, right: width - 17, top: 25, bottom: height - 31 };
  const toX = (t) => plot.left + t / (state.duration || 1) * (plot.right - plot.left);
  const toY = (v) => plot.bottom - (v - min) / (max - min) * (plot.bottom - plot.top);
  ctx.font = '9px "DM Sans", sans-serif';
  const yStep = niceStep(max - min, 4);
  for (let value = Math.ceil(min / yStep) * yStep; value <= max; value += yStep) {
    const y = toY(value);
    line(ctx, plot.left, y, plot.right, y, Math.abs(value) < 1e-8 ? '#d1ddee' : colors.grid);
    ctx.fillStyle = '#99a5b3'; ctx.textAlign = 'right'; ctx.fillText(axisFormat(value, yStep), plot.left - 9, y + 3);
  }
  const xStep = niceStep(state.duration, width < 400 ? 4 : 6);
  for (let value = 0; value <= state.duration; value += xStep) {
    const x = toX(value);
    line(ctx, x, plot.top, x, plot.bottom, colors.grid);
    ctx.fillStyle = '#99a5b3'; ctx.textAlign = 'center'; ctx.fillText(axisFormat(value, xStep), x, plot.bottom + 16);
  }
  ctx.fillStyle = '#8497b0'; ctx.textAlign = 'left'; ctx.font = '9px "DM Sans", sans-serif';
  ctx.fillText(`${quantity.symbol} (${quantity.unit})`, 9, 13);
  ctx.textAlign = 'right'; ctx.fillText('t (s)', width - 5, height - 3);

  function path(parameters, endTime) {
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const t = endTime * i / 160;
      const x = toX(t); const y = toY(sample(parameters, t)[key]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(plot.left - 1, plot.top, plot.right - plot.left + 2, plot.bottom - plot.top); ctx.clip();
  if (compare) {
    path(reference, state.duration); ctx.strokeStyle = colors.orange; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
  }
  path(state, state.duration); ctx.strokeStyle = '#b9d0f8'; ctx.lineWidth = 2; ctx.stroke();
  if (state.time > 0) {
    path(state, state.time);
    ctx.lineTo(toX(state.time), toY(0)); ctx.lineTo(toX(0), toY(0)); ctx.closePath();
    const gradient = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
    gradient.addColorStop(0, '#2563eb15'); gradient.addColorStop(1, '#2563eb03'); ctx.fillStyle = gradient; ctx.fill();
    path(state, state.time); ctx.strokeStyle = colors.blue; ctx.lineWidth = 2.3; ctx.stroke();
  }
  const currentX = toX(state.time);
  const currentY = toY(sample(state, state.time)[key]);
  ctx.setLineDash([3, 4]); line(ctx, currentX, plot.top, currentX, plot.bottom, '#88b3ed', 1); ctx.setLineDash([]);
  ctx.restore();
  ctx.beginPath(); ctx.arc(currentX, currentY, 6, 0, Math.PI * 2); ctx.fillStyle = '#2563eb18'; ctx.fill();
  ctx.beginPath(); ctx.arc(currentX, currentY, 3.5, 0, Math.PI * 2); ctx.fillStyle = colors.blue; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

  const label = `${format(sample(state, state.time)[key], 1)} ${quantity.unit}`;
  ctx.font = '9px "DM Sans", sans-serif';
  const labelWidth = ctx.measureText(label).width + 14;
  const labelX = Math.max(plot.left, Math.min(plot.right - labelWidth, currentX + 10));
  const labelY = Math.max(plot.top, Math.min(plot.bottom - 21, currentY - 26));
  roundedRect(ctx, labelX, labelY, labelWidth, 20, 4, '#edf4ff');
  ctx.textAlign = 'left'; ctx.fillStyle = colors.blue; ctx.fillText(label, labelX + 7, labelY + 13);
  $('legend-label').textContent = `${quantity.name} · ${state.mode.toUpperCase()}`;
  $('compare-legend').hidden = !compare;
  $('chart').setAttribute('aria-label', `Gráfica de ${quantity.name.toLowerCase()} respecto al tiempo. Valor actual: ${label}, en t = ${format(state.time)} segundos.${compare ? ' Incluye referencia MRU con la misma posición y velocidad iniciales.' : ''}`);
}

function render() {
  const current = sample(state, state.time);
  $('position-value').textContent = format(current.position);
  $('velocity-value').textContent = format(current.velocity);
  $('acceleration-value').textContent = format(current.acceleration);
  for (const key of ['position', 'velocity', 'acceleration']) {
    $(`${key}-value`).classList.toggle('compact', format(current[key]).length > 7);
  }
  $('time-value').textContent = format(state.time);
  $('timeline').value = state.time;
  rangeProgress($('timeline'));
  $('play').classList.toggle('is-playing', state.playing);
  $('play').querySelector('use').setAttribute('href', state.playing ? '#i-pause' : '#i-play');
  $('play').querySelector('span').textContent = state.playing ? 'Pausar' : state.time >= state.duration ? 'Repetir' : state.time > 0 ? 'Seguir' : 'Iniciar';
  $('play').setAttribute('aria-label', state.playing ? 'Pausar simulación' : state.time >= state.duration ? 'Repetir simulación' : 'Iniciar o continuar simulación');
  const status = state.playing ? 'En movimiento' : state.time >= state.duration ? 'Experimento completo' : state.time > 0 ? 'En pausa' : 'Listo para empezar';
  $('status').classList.toggle('running', state.playing);
  $('status').lastChild.textContent = status;
  drawScene();
  drawChart();
}

const observer = new ResizeObserver(() => render());
observer.observe($('scene').parentElement);
observer.observe($('chart').parentElement);
if (document.fonts) document.fonts.ready.then(render);
syncControls();
render();
