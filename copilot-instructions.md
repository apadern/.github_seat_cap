---
applyTo: '**'
---

## 1. Objetivo y alcance (SAP CAP)
Este documento define pautas para generar y mantener código orientado exclusivamente a SAP CAP (Cloud Application Programming Model), priorizando calidad, mantenibilidad, rendimiento y consistencia.

- El foco es backend CAP: modelos CDS, servicios y handlers en Node.js.
- Ámbito principal: `db/**`, `srv/**`, `gen/**`, `*.cds`.
- Responder siempre en español (respuestas al usuario; los comentarios de código siguen el patrón bilingüe definido en la sección 2).
- Añadir comentarios solo cuando aporten contexto no evidente.

## 2. Idioma y nomenclatura
- Código (funciones, variables, clases): en inglés.
- Comentarios: español primero y luego inglés, separados por ` / `.
  - Ejemplo: `// Valida la entrada del usuario / Validates user input`
- Usar nombres claros y orientados al dominio de negocio.

## 3. Estructura del proyecto (CAP)
Organizar la solución con estructura CAP estándar:

- `db/`: modelo de dominio y persistencia (entidades, tipos, vistas, datos iniciales).
- `srv/`: definición de servicios (`*.cds`) y lógica (`*.js`).
- `srv/lib/`: utilidades reutilizables de negocio e integración.
- `test/` o `*.test.js`: pruebas unitarias y de integración.
- `gen/`: artefactos generados (sin lógica manual salvo necesidad justificada).

## 4. Modelado CDS
- Diseñar modelos cohesivos y legibles.
- Reutilizar tipos y aspectos comunes para evitar duplicidad.
- Nombrar entidades y elementos de forma semántica y estable.
- Evitar mezclar reglas de presentación en el modelo de dominio.
- Mantener compatibilidad de contrato cuando el servicio ya esté consumido.

## 5. Servicios y handlers (Node.js)
- Implementar handlers con responsabilidad única.
- **No definir funciones en el fichero `srv/<serviceName>.js`**; toda la lógica debe residir en la clase lib (`srv/lib/<serviceName>Mng.js`). El fichero de servicio solo contiene: declaración de conexiones, instanciación de la lib y registro de handlers.
- Separar validación, transformación y acceso a datos en funciones pequeñas dentro de la clase lib.
- Reutilizar lógica común en `srv/lib/`.
- Usar APIs CAP (`cds`) de forma idiomática y consistente.
- Gestionar errores de forma explícita, con mensajes claros y accionables.
- Evitar efectos secundarios ocultos.

## 6. Consultas, transacciones y rendimiento
- Pedir solo los campos necesarios.
- Evitar operaciones N+1 y llamadas repetitivas dentro de bucles.
- Agrupar lecturas/escrituras cuando sea posible.
- Respetar el contexto transaccional de CAP (`cds.transaction(req)` cuando aplique).
- Diseñar operaciones idempotentes en escenarios de reintento.
- Diferenciar los dos modelos de transacción:
  - `cds.transaction(req)`: CAP gestiona commit y rollback automáticamente al final del request.
  - `db.tx()`: transacción manual; **siempre** cerrar con `await tx.commit()` o `await tx.rollback()` dentro de un bloque `try/catch/finally`, incluso en operaciones de solo lectura. No hacerlo deja la conexión abierta.

```js
// ✅ Correcto: tx manual con cierre garantizado
let tx;
try {
    tx = await db.tx();
    await tx.run(INSERT.into(entityName).entries(oData));
    await tx.commit();
} catch (err) {
    if (tx) await tx.rollback();
    throw err;
}
```

## 7. Validación y seguridad
- Validar entradas de acciones/funciones/eventos antes de procesar.
- No confiar en datos del cliente sin comprobación.
- No exponer secretos ni trazas sensibles en respuestas de error.
- Diferenciar errores funcionales de errores técnicos.
- Aplicar principio de mínimo privilegio en acceso a datos y operaciones.

## 8. Estilo de código JavaScript
- Priorizar legibilidad y simplicidad.
- Usar funciones pequeñas y con nombres descriptivos.
- Usar operador ternario solo en condiciones simples y legibles.
- Reducir anidación profunda extrayendo funciones auxiliares.
- Evitar abstracciones prematuras.

## 9. Testing
- Añadir pruebas unitarias para lógica crítica.
- Añadir pruebas de integración para contratos de servicio relevantes.
- Cubrir casos positivos, negativos y bordes.
- Mantener pruebas deterministas y aisladas.
- Si se cambia comportamiento, actualizar/añadir pruebas en la misma tarea.

## 10. Formato y mantenimiento
- Mantener formato consistente.
- Evitar cambios cosméticos fuera de alcance.
- Priorizar cambios pequeños, revisables y con bajo riesgo.
- No editar manualmente `gen/**` salvo necesidad explícita.

## 11. Control de versiones
- Commits claros, concisos y explicando el motivo del cambio.
- No mezclar refactors amplios con cambios funcionales no relacionados.
- Sincronizar rama antes de crear nuevas ramas para reducir conflictos.

## 12. Criterio final de calidad
Toda contribución CAP debe ser:

- Correcta funcionalmente.
- Fácil de entender y mantener.
- Segura y validada.
- Probada en función del impacto del cambio.