# movimiento. — Calculadora y simulador de MRU y MRUV

## Qué puedes hacer

- Calcular distancia/desplazamiento, velocidad o tiempo en MRU.
- Despejar desplazamiento, velocidad inicial, velocidad final, aceleración, tiempo o posición final en MRUV; elegir la fórmula según los datos conocidos.
- Consultar el resultado con sus unidades, la fórmula y la sustitución de tus datos. La calculadora admite decimales y valores fuera de los rangos de la simulación.
- Detectar datos incompletos, divisiones por cero y casos sin solución. Cuando existen dos tiempos válidos, se muestran ambos.
- Actualizar automáticamente la gráfica, la animación y los parámetros del simulador al calcular. Si hay dos soluciones, puedes elegir cuál representar; inicialmente se muestra la de mayor duración.
- Alternar entre movimiento rectilíneo uniforme (MRU) y uniformemente variado (MRUV).
- Ajustar posición inicial, velocidad, aceleración y duración.
- Iniciar, pausar, reiniciar o avanzar 0,1 segundos; cambiar la velocidad de reproducción.
- Arrastrar la línea de tiempo para examinar cualquier instante.
- Ver las gráficas de posición, velocidad y aceleración. La parte clara anticipa la trayectoria; la oscura muestra el tiempo transcurrido.
- Comparar el MRUV con un MRU que tiene la misma posición y velocidad iniciales.
- Probar tres experimentos preconfigurados, incluidos el frenado y el cambio de dirección.
- Usar la barra espaciadora para iniciar o pausar cuando el foco no está en un control.

Los cambios en los parámetros reinician el experimento. La pista ajusta su escala a la trayectoria completa, incluido el punto de retorno; no hay rebotes ni límites artificiales. El tiempo mostrado es el tiempo físico; «Ritmo» solo cambia la velocidad de reproducción.

Cada cálculo válido configura el simulador con su posición inicial, velocidad, aceleración y duración, incluso fuera de los rangos originales de los deslizadores. Se selecciona la gráfica correspondiente a la incógnita y se muestra el instante del resultado (el inicial para v₀, el final para las demás magnitudes). Si no se proporciona x₀, se usa 0 m. Si el objeto está en reposo sin aceleración y los datos no determinan un tiempo, se indica expresamente que se muestra un intervalo de 12 s. Un tiempo de cero representa solo el punto inicial.

Puedes seguir explorando manualmente: al cambiar los parámetros se indica que la gráfica ya no corresponde al cálculo. Si editas los datos de arriba o el cálculo es inválido, la gráfica conserva el último movimiento y solicita volver a calcular. En las fórmulas, `d = xƒ − x₀` es el desplazamiento con signo: su valor absoluto coincide con la distancia recorrida únicamente si no hay cambios de sentido. Se admiten tiempos mayores o iguales a cero y se descartan soluciones que solo ocurren en tiempos negativos.

## Modelo físico

- MRU: `x(t) = x₀ + v₀t`, `v(t) = v₀`, `a = 0`.
- MRUV: `x(t) = x₀ + v₀t + ½at²`, `v(t) = v₀ + at`.
- Unidades del Sistema Internacional: metros, segundos, m/s y m/s².
- El modelo no incluye rozamiento y admite posiciones y velocidades negativas.

## Archivos

- `index.html`: interfaz y contenido educativo.
- `styles.css`: diseño adaptable a móviles y escritorio.
- `physics.js`: cálculos físicos independientes de la interfaz.
- `app.js`: controles, animación y gráficas en canvas.

## Pruebas

Con Node.js instalado: `node --test physics.test.js`.
