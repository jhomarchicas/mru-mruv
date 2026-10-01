(function (root) {
  'use strict';

  function sample(parameters, time) {
    const acceleration = parameters.mode === 'mru' ? 0 : parameters.acceleration;
    return {
      position: parameters.position + parameters.velocity * time + 0.5 * acceleration * time * time,
      velocity: parameters.velocity + acceleration * time,
      acceleration,
    };
  }

  function positionBounds(parameters) {
    const positions = [parameters.position, sample(parameters, parameters.duration).position];
    const acceleration = sample(parameters, 0).acceleration;
    if (acceleration !== 0) {
      const turningTime = -parameters.velocity / acceleration;
      if (turningTime > 0 && turningTime < parameters.duration) positions.push(sample(parameters, turningTime).position);
    }
    return { min: Math.min(...positions), max: Math.max(...positions) };
  }

  function niceStep(span, targetTicks = 7) {
    const rough = Math.max(span, 0.001) / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;
    return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  }

  const quantities = {
    distance: { label: 'Distancia / desplazamiento', symbol: 'd', unit: 'm' },
    velocity: { label: 'Velocidad', symbol: 'v', unit: 'm/s' },
    initialVelocity: { label: 'Velocidad inicial', symbol: 'v₀', unit: 'm/s' },
    finalVelocity: { label: 'Velocidad final', symbol: 'vƒ', unit: 'm/s' },
    acceleration: { label: 'Aceleración', symbol: 'a', unit: 'm/s²' },
    time: { label: 'Tiempo', symbol: 't', unit: 's' },
    initialPosition: { label: 'Posición inicial', symbol: 'x₀', unit: 'm' },
    finalPosition: { label: 'Posición final', symbol: 'xƒ', unit: 'm' },
  };

  function divide(numerator, denominator) {
    if (denominator === 0) {
      throw new Error(numerator === 0
        ? 'Estos datos no determinan un único resultado: hay infinitas soluciones.'
        : 'No hay solución con estos datos: el divisor es cero.');
    }
    return numerator / denominator;
  }

  function squareRoots(value) {
    if (value < 0) throw new Error('No hay solución real: el valor dentro de la raíz es negativo.');
    const root = Math.sqrt(value);
    return root === 0 ? [0] : [-root, root];
  }

  function timeRoots(distance, velocity, acceleration) {
    if (acceleration === 0) return [divide(distance, velocity)];
    const discriminant = velocity * velocity + 2 * acceleration * distance;
    if (discriminant < 0) throw new Error('El objeto no alcanza ese desplazamiento con los datos indicados.');
    const root = Math.sqrt(discriminant);
    // Stable quadratic evaluation, including the double root at rest.
    if (root === 0) return [-velocity / acceleration];
    const q = -0.5 * (velocity + (velocity < 0 ? -root : root));
    return [q / (0.5 * acceleration), -distance / q];
  }

  function finalVelocityRoots(velocity, acceleration, distance) {
    if (acceleration === 0) {
      if (velocity === 0 && distance !== 0) throw new Error('Un objeto en reposo y sin aceleración no puede desplazarse.');
      if (velocity !== 0 && distance / velocity < 0) throw new Error('El desplazamiento no se alcanza para un tiempo mayor o igual a cero.');
      return [velocity];
    }
    return squareRoots(velocity * velocity + 2 * acceleration * distance)
      .filter((finalVelocity) => (finalVelocity - velocity) / acceleration >= 0);
  }

  const calculatorMethods = {
    mru: [
      { id: 'mru-distance', target: 'distance', fields: ['velocity', 'time'], formula: 'd = v × t', solve: ({ velocity: v, time: t }) => v * t },
      { id: 'mru-velocity', target: 'velocity', fields: ['distance', 'time'], formula: 'v = d / t', solve: ({ distance: d, time: t }) => divide(d, t) },
      { id: 'mru-time', target: 'time', fields: ['distance', 'velocity'], formula: 't = d / v', solve: ({ distance: d, velocity: v }) => divide(d, v) },
    ],
    mruv: [
      { id: 'mruv-distance-time', target: 'distance', fields: ['initialVelocity', 'acceleration', 'time'], formula: 'd = v₀ × t + ½ × a × t²', solve: ({ initialVelocity: v, acceleration: a, time: t }) => v * t + 0.5 * a * t * t },
      { id: 'mruv-distance-average', target: 'distance', fields: ['initialVelocity', 'finalVelocity', 'time'], formula: 'd = (v₀ + vƒ) × t / 2', solve: ({ initialVelocity: v, finalVelocity: f, time: t }) => (v + f) * t / 2 },
      { id: 'mruv-distance-velocities', target: 'distance', fields: ['initialVelocity', 'finalVelocity', 'acceleration'], formula: 'd = (vƒ² − v₀²) / (2 × a)', solve: ({ initialVelocity: v, finalVelocity: f, acceleration: a }) => divide(f * f - v * v, 2 * a) },
      { id: 'mruv-final-velocity-time', target: 'finalVelocity', fields: ['initialVelocity', 'acceleration', 'time'], formula: 'vƒ = v₀ + a × t', solve: ({ initialVelocity: v, acceleration: a, time: t }) => v + a * t },
      { id: 'mruv-final-velocity-distance', target: 'finalVelocity', fields: ['initialVelocity', 'acceleration', 'distance'], formula: 'vƒ = ±√(v₀² + 2 × a × d)', solve: ({ initialVelocity: v, acceleration: a, distance: d }) => finalVelocityRoots(v, a, d) },
      { id: 'mruv-initial-velocity-time', target: 'initialVelocity', fields: ['finalVelocity', 'acceleration', 'time'], formula: 'v₀ = vƒ − a × t', solve: ({ finalVelocity: f, acceleration: a, time: t }) => f - a * t },
      { id: 'mruv-initial-velocity-distance', target: 'initialVelocity', fields: ['distance', 'acceleration', 'time'], formula: 'v₀ = (d − ½ × a × t²) / t', solve: ({ distance: d, acceleration: a, time: t }) => divide(d - 0.5 * a * t * t, t) },
      { id: 'mruv-acceleration-velocities', target: 'acceleration', fields: ['initialVelocity', 'finalVelocity', 'time'], formula: 'a = (vƒ − v₀) / t', solve: ({ initialVelocity: v, finalVelocity: f, time: t }) => divide(f - v, t) },
      { id: 'mruv-acceleration-distance', target: 'acceleration', fields: ['distance', 'initialVelocity', 'time'], formula: 'a = 2 × (d − v₀ × t) / t²', solve: ({ distance: d, initialVelocity: v, time: t }) => divide(2 * (d - v * t), t * t) },
      { id: 'mruv-acceleration-no-time', target: 'acceleration', fields: ['initialVelocity', 'finalVelocity', 'distance'], formula: 'a = (vƒ² − v₀²) / (2 × d)', solve: ({ initialVelocity: v, finalVelocity: f, distance: d }) => divide(f * f - v * v, 2 * d) },
      { id: 'mruv-time-velocities', target: 'time', fields: ['initialVelocity', 'finalVelocity', 'acceleration'], formula: 't = (vƒ − v₀) / a', solve: ({ initialVelocity: v, finalVelocity: f, acceleration: a }) => divide(f - v, a) },
      { id: 'mruv-time-distance', target: 'time', fields: ['distance', 'initialVelocity', 'acceleration'], formula: 'd = v₀ × t + ½ × a × t²', solve: ({ distance: d, initialVelocity: v, acceleration: a }) => timeRoots(d, v, a) },
      { id: 'mruv-time-average', target: 'time', fields: ['distance', 'initialVelocity', 'finalVelocity'], formula: 't = 2 × d / (v₀ + vƒ)', solve: ({ distance: d, initialVelocity: v, finalVelocity: f }) => divide(2 * d, v + f) },
      { id: 'mruv-position', target: 'finalPosition', fields: ['initialPosition', 'initialVelocity', 'acceleration', 'time'], formula: 'xƒ = x₀ + v₀ × t + ½ × a × t²', solve: ({ initialPosition: x, initialVelocity: v, acceleration: a, time: t }) => x + v * t + 0.5 * a * t * t },
    ],
  };

  function calculate(mode, methodId, values) {
    const method = calculatorMethods[mode]?.find((item) => item.id === methodId);
    if (!method) throw new Error('Selecciona un cálculo válido.');
    for (const field of method.fields) {
      if (typeof values[field] !== 'number' || !Number.isFinite(values[field])) {
        throw new Error(`Introduce un valor válido para ${quantities[field].label.toLowerCase()}.`);
      }
    }
    if (method.fields.includes('time') && values.time < 0) throw new Error('El tiempo no puede ser negativo.');
    if (values.time === 0 && method.fields.includes('initialVelocity') && method.fields.includes('finalVelocity') && values.initialVelocity !== values.finalVelocity) {
      throw new Error('En un tiempo de cero, la velocidad inicial y la final deben coincidir.');
    }
    if (['initialVelocity', 'finalVelocity', 'acceleration'].every((field) => method.fields.includes(field))) {
      if (values.acceleration === 0 && values.initialVelocity !== values.finalVelocity) {
        throw new Error('Sin aceleración, la velocidad inicial y la final deben coincidir.');
      }
      if (values.acceleration !== 0 && (values.finalVelocity - values.initialVelocity) / values.acceleration < 0) {
        throw new Error('No hay solución para un tiempo mayor o igual a cero.');
      }
    }
    const solved = method.solve(values);
    let results = Array.isArray(solved) ? solved : [solved];
    if (results.some((value) => !Number.isFinite(value))) throw new Error('El resultado es demasiado grande. Revisa los datos.');
    if (method.target === 'time') {
      results = results.filter((value) => value >= 0 && !(value === 0 && method.fields.includes('finalVelocity') && values.initialVelocity !== values.finalVelocity));
    }
    if (!results.length) throw new Error('No hay solución para un tiempo mayor o igual a cero.');
    results = [...new Set(results.map((value) => Object.is(value, -0) ? 0 : value))].sort((a, b) => a - b);
    return { target: method.target, results, formula: method.formula };
  }

  function calculationMotion(mode, methodId, values, solutionIndex = 0) {
    const result = calculate(mode, methodId, values);
    if (!Number.isInteger(solutionIndex) || solutionIndex < 0 || solutionIndex >= result.results.length) {
      throw new Error('Selecciona una solución válida para la gráfica.');
    }
    const method = calculatorMethods[mode].find((item) => item.id === methodId);
    const data = Object.fromEntries(method.fields.map((field) => [field, values[field]]));
    data[result.target] = result.results[solutionIndex];
    let duration = data.time;
    let timeDetermined = true;
    let velocity;
    let acceleration;
    if (mode === 'mru') {
      velocity = data.velocity;
      acceleration = 0;
    } else {
      velocity = data.initialVelocity;
      acceleration = data.acceleration;
      if (duration === undefined) {
        if (acceleration !== 0) duration = (data.finalVelocity - velocity) / acceleration;
        else if (velocity !== 0) duration = data.distance / velocity;
        else {
          // At rest without acceleration, every observation interval is valid.
          duration = 12;
          timeDetermined = false;
        }
      }
      if (acceleration === undefined) acceleration = duration === 0 ? 0 : (data.finalVelocity - velocity) / duration;
    }
    const motion = { mode, position: data.initialPosition ?? 0, velocity, acceleration, duration, timeDetermined };
    const end = sample(motion, duration);
    const bounds = positionBounds(motion);
    if (duration < 0 || ![motion.position, velocity, acceleration, duration, end.position, end.velocity, bounds.max - bounds.min].every(Number.isFinite)) {
      throw new Error('Estos datos no permiten representar una trayectoria finita.');
    }
    return motion;
  }

  const physics = { sample, positionBounds, niceStep, quantities, calculatorMethods, calculate, calculationMotion };
  if (typeof module !== 'undefined' && module.exports) module.exports = physics;
  else root.MotionPhysics = physics;
})(typeof window !== 'undefined' ? window : globalThis);
