'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample, positionBounds, niceStep, calculate, calculatorMethods, calculationMotion } = require('./physics');

const defaults = { mode: 'mru', position: 0, velocity: 8, acceleration: 1.5, duration: 12 };

test('MRU ignora la aceleración configurada y mantiene la velocidad', () => {
  assert.deepEqual(sample(defaults, 12), { position: 96, velocity: 8, acceleration: 0 });
});
test('MRUV desde el reposo', () => {
  assert.deepEqual(sample({ ...defaults, mode: 'mruv', velocity: 0 }, 12), { position: 108, velocity: 18, acceleration: 1.5 });
});
test('el frenado alcanza reposo e invierte el sentido sin detener el tiempo', () => {
  const params = { ...defaults, mode: 'mruv', velocity: 12, acceleration: -2 };
  assert.deepEqual(sample(params, 6), { position: 36, velocity: 0, acceleration: -2 });
  assert.deepEqual(sample(params, 12), { position: 0, velocity: -12, acceleration: -2 });
  assert.deepEqual(positionBounds(params), { min: 0, max: 36 });
});
test('incluye el punto mínimo de retorno', () => {
  assert.deepEqual(positionBounds({ ...defaults, mode: 'mruv', position: 10, velocity: -12, acceleration: 2 }), { min: -26, max: 10 });
});
test('velocidad negativa en MRU y posición inicial desplazada', () => {
  const params = { ...defaults, position: -15, velocity: -4 };
  assert.equal(sample(params, 5).position, -35);
  assert.deepEqual(positionBounds(params), { min: -63, max: -15 });
});
test('un vehículo inmóvil tiene límites finitos', () => {
  const params = { ...defaults, mode: 'mruv', velocity: 0, acceleration: 0, position: 20 };
  assert.deepEqual(positionBounds(params), { min: 20, max: 20 });
});
test('no incluye un punto de retorno fuera del experimento', () => {
  assert.deepEqual(positionBounds({ ...defaults, mode: 'mruv', velocity: 12, acceleration: -0.5, duration: 2 }), { min: 0, max: 23 });
});
test('la graduación de los ejes es positiva para intervalos pequeños y grandes', () => {
  for (const span of [0, 0.001, 0.1, 20, 100, 18000]) {
    const step = niceStep(span);
    assert.ok(Number.isFinite(step) && step > 0);
  }
});

test('MRU despeja distancia, velocidad y tiempo, sin límites de simulación', () => {
  assert.deepEqual(calculate('mru', 'mru-distance', { velocity: 80, time: 120 }).results, [9600]);
  assert.deepEqual(calculate('mru', 'mru-velocity', { distance: 150, time: 12 }).results, [12.5]);
  assert.deepEqual(calculate('mru', 'mru-time', { distance: 100, velocity: 20 }).results, [5]);
  assert.deepEqual(calculate('mru', 'mru-time', { distance: -100, velocity: -20 }).results, [5]);
});

test('todos los despejes MRUV coinciden con una trayectoria conocida', () => {
  const values = { distance: 75, initialVelocity: 10, finalVelocity: 20, acceleration: 2, time: 5, initialPosition: 15, finalPosition: 90 };
  for (const method of calculatorMethods.mruv) {
    const result = calculate('mruv', method.id, values);
    assert.ok(result.results.some((value) => Math.abs(value - values[method.target]) < 1e-10), method.id);
  }
});

test('el cálculo de tiempo devuelve dos instantes al frenar y volver', () => {
  assert.deepEqual(calculate('mruv', 'mruv-time-distance', { distance: 32, initialVelocity: 12, acceleration: -2 }).results, [4, 8]);
  assert.deepEqual(calculate('mruv', 'mruv-time-distance', { distance: 36, initialVelocity: 12, acceleration: -2 }).results, [6]);
});

test('el tiempo cuadrático admite reposo, aceleración cero y descarta raíces negativas', () => {
  assert.deepEqual(calculate('mruv', 'mruv-time-distance', { distance: 100, initialVelocity: 0, acceleration: 2 }).results, [10]);
  assert.deepEqual(calculate('mruv', 'mruv-time-distance', { distance: 20, initialVelocity: 4, acceleration: 0 }).results, [5]);
  assert.deepEqual(calculate('mruv', 'mruv-time-distance', { distance: 0, initialVelocity: 0, acceleration: 2 }).results, [0]);
  assert.deepEqual(calculate('mruv', 'mruv-time-distance', { distance: 0, initialVelocity: 12, acceleration: -2 }).results, [0, 12]);
});

test('la velocidad final respeta el sentido y los instantes físicamente posibles', () => {
  assert.deepEqual(calculate('mruv', 'mruv-final-velocity-distance', { initialVelocity: 12, acceleration: -2, distance: 32 }).results, [-4, 4]);
  assert.deepEqual(calculate('mruv', 'mruv-final-velocity-distance', { initialVelocity: 10, acceleration: 2, distance: 75 }).results, [20]);
  assert.deepEqual(calculate('mruv', 'mruv-final-velocity-distance', { initialVelocity: -4, acceleration: 0, distance: -20 }).results, [-4]);
});

test('valida entradas vacías, no finitas y tiempos negativos', () => {
  for (const velocity of [undefined, '', NaN, Infinity]) {
    assert.throws(() => calculate('mru', 'mru-distance', { velocity, time: 5 }), /valor válido/);
  }
  assert.throws(() => calculate('mru', 'mru-distance', { velocity: 5, time: -1 }), /negativo/);
  assert.throws(() => calculate('mru', 'unknown', {}), /válido/);
  assert.throws(() => calculate('mru', 'mru-distance', { velocity: 1e308, time: 100 }), /demasiado grande/);
});

test('distingue división por cero, infinitas soluciones y trayectorias imposibles', () => {
  assert.throws(() => calculate('mru', 'mru-velocity', { distance: 10, time: 0 }), /divisor es cero/);
  assert.throws(() => calculate('mru', 'mru-time', { distance: 0, velocity: 0 }), /infinitas/);
  assert.throws(() => calculate('mru', 'mru-time', { distance: -10, velocity: 2 }), /No hay solución/);
  assert.throws(() => calculate('mruv', 'mruv-time-distance', { distance: 40, initialVelocity: 12, acceleration: -2 }), /no alcanza/);
  assert.throws(() => calculate('mruv', 'mruv-final-velocity-distance', { initialVelocity: 0, acceleration: -2, distance: 10 }), /raíz es negativo/);
  assert.throws(() => calculate('mruv', 'mruv-distance-average', { initialVelocity: 0, finalVelocity: 10, time: 0 }), /deben coincidir/);
  assert.throws(() => calculate('mruv', 'mruv-final-velocity-distance', { initialVelocity: 0, acceleration: 0, distance: 10 }), /no puede desplazarse/);
  assert.throws(() => calculate('mruv', 'mruv-distance-velocities', { initialVelocity: 10, finalVelocity: 5, acceleration: 2 }), /No hay solución/);
  assert.throws(() => calculate('mruv', 'mruv-time-velocities', { initialVelocity: 10, finalVelocity: 5, acceleration: 0 }), /deben coincidir/);
});

test('los campos de entrada no contienen la incógnita que se calcula', () => {
  for (const methods of Object.values(calculatorMethods)) {
    for (const method of methods) assert.ok(!method.fields.includes(method.target), method.id);
  }
});

test('cada despeje MRU configura la misma trayectoria que el cálculo', () => {
  const values = { distance: 150, velocity: 30, time: 5 };
  for (const method of calculatorMethods.mru) {
    const motion = calculationMotion('mru', method.id, values);
    assert.equal(motion.position, 0);
    assert.equal(motion.velocity, 30);
    assert.equal(motion.acceleration, 0);
    assert.equal(motion.duration, 5);
    assert.equal(sample(motion, motion.duration).position, 150);
  }
});

test('cada despeje MRUV reconstruye velocidad, aceleración y tiempo conocidos', () => {
  const values = { distance: 75, initialVelocity: 10, finalVelocity: 20, acceleration: 2, time: 5, initialPosition: 15, finalPosition: 90 };
  for (const method of calculatorMethods.mruv) {
    const motion = calculationMotion('mruv', method.id, values);
    assert.equal(motion.velocity, 10, method.id);
    assert.equal(motion.acceleration, 2, method.id);
    assert.equal(motion.duration, 5, method.id);
    assert.equal(motion.position, method.target === 'finalPosition' ? 15 : 0, method.id);
    assert.equal(sample(motion, 5).position - motion.position, 75, method.id);
  }
});

test('cada solución de frenado usa su propio tiempo y velocidad final', () => {
  const values = { distance: 32, initialVelocity: 12, acceleration: -2 };
  for (const method of ['mruv-time-distance', 'mruv-final-velocity-distance']) {
    const result = calculate('mruv', method, values);
    result.results.forEach((value, index) => {
      const motion = calculationMotion('mruv', method, values, index);
      const end = sample(motion, motion.duration);
      assert.equal(end.position, 32);
      assert.equal(method === 'mruv-time-distance' ? motion.duration : end.velocity, value);
    });
  }
});

test('la trayectoria respeta valores grandes, fracciones y velocidades negativas', () => {
  const large = calculationMotion('mru', 'mru-distance', { velocity: 80, time: 120 });
  assert.equal(large.duration, 120);
  assert.equal(sample(large, 120).position, 9600);
  const fractional = calculationMotion('mru', 'mru-time', { distance: -0.125, velocity: -0.5 });
  assert.equal(fractional.duration, 0.25);
  assert.equal(sample(fractional, 0.25).position, -0.125);
});

test('un instante inicial no se convierte en una duración artificial', () => {
  const mru = calculationMotion('mru', 'mru-distance', { velocity: 10, time: 0 });
  assert.equal(mru.duration, 0);
  assert.deepEqual(sample(mru, 0), { position: 0, velocity: 10, acceleration: 0 });
  const mruv = calculationMotion('mruv', 'mruv-distance-average', { initialVelocity: 5, finalVelocity: 5, time: 0 });
  assert.equal(mruv.duration, 0);
  assert.equal(sample(mruv, 0).velocity, 5);
});

test('el reposo de duración indeterminada se identifica expresamente', () => {
  const motion = calculationMotion('mruv', 'mruv-final-velocity-distance', { initialVelocity: 0, acceleration: 0, distance: 0 });
  assert.equal(motion.timeDetermined, false);
  assert.deepEqual(sample(motion, motion.duration), { position: 0, velocity: 0, acceleration: 0 });
  assert.throws(() => calculationMotion('mru', 'mru-distance', { velocity: 1, time: 2 }, 5), /solución válida/);
});
