---
applyTo: '**/*.cds,**/srv/**/*.js,**/db/**,**/gen/**'
---

## 1. Introducción e instrucciones para la generación de código CAP
Este documento presenta las mejores prácticas para desarrollar servicios backend usando SAP CAP (Cloud Application Programming Model) con Node.js, con el objetivo de mejorar la calidad del código y la mantenibilidad.

- Tu objetivo es proporcionar código que siga las mejores prácticas en modularidad, rendimiento y seguridad, utilizando los patrones nativos de CAP (`this.on`, `this.before`, `this.after`, CDS queries, etc.).
- Debes seguir las instrucciones y pautas proporcionadas a continuación para garantizar que el código generado sea claro, mantenible y cumpla con los requisitos del proyecto.
- Cuando respondas a una solicitud debes responder en español.
- No es necesario que generes comentarios con respuestas a la solicitud que has recibido. Si se añade un comentario es porque aporta para entender el código o para explicar algo que no es evidente.

## 2. Idioma
**Comentarios**: Todos los comentarios deben estar en **español primero** seguido de inglés, separados por " / " ("Descripción en español / English description"). El orden español/inglés es obligatorio y debe respetarse de forma consistente en todos los ficheros.

**Código**: Los nombres de funciones, variables, entidades CDS y servicios deben estar en inglés.

## 3. Estructura del Proyecto
**Organización de carpetas**:
- `db/`: Definiciones del modelo de datos en CDS (entidades, tipos, asociaciones).
- `srv/`: Definiciones de servicio CDS (`.cds`) e implementaciones Node.js (`.js`).
- `srv/lib/`: Librerías de utilidad con lógica de negocio extraída del servicio principal.
- `test/` ó ficheros `*.test.js` junto a los ficheros de servicio: pruebas unitarias y de integración.

**Otros archivos**:
- `package.json`: Dependencias, scripts (`start`, `test`, `build`) y configuración `cds` (odata version, requires, etc.).
- `mta.yaml`: Descriptor de despliegue multi-target (módulos, recursos, bindings de servicios BTP).
- `xs-security.json`: Definición de roles y scopes XSUAA.
- `default-env.json`: Variables de entorno locales para desarrollo (no subir al repositorio).

## 4. Modelado CDS

**Entidades**: Usar `PascalCase` para nombres de entidad. Los campos usan `camelCase`.

```cds
entity WorkOrders : cuid, managed {
    title       : String(100);
    status      : String(20);
    assignedTo  : Association to Users;
}
```

**Servicios**: El nombre del servicio debe describir el dominio funcional y terminar en `Service`. La ruta (`@path`) usa `kebab-case`.

```cds
@path: 'work-order-service'
service WorkOrderService {
    entity WorkOrders as projection on db.WorkOrders;
    action submitOrder(orderId: UUID) returns String;
}
```

**Acciones y funciones**:
- `action`: operación con efecto secundario (crea, modifica, elimina datos). Se invoca con POST.
- `function`: operación de solo lectura. Se invoca con GET.
- Usar `camelCase` para sus nombres.

**Anotaciones de seguridad**:
- Siempre anotar el servicio o sus operaciones con `@requires` para controlar el acceso.
- No dejar servicios expuestos sin restricción en producción.

```cds
@requires: 'authenticated-user'
service WorkOrderService { ... }
```

**Tipos personalizados**: Usar `PascalCase` para tipos CDS y ubicarlos en el fichero `.cds` del servicio o en un fichero `types.cds` compartido.

## 5. Implementación del Servicio (Node.js)

**Patrón de exportación**: Cada fichero de servicio exporta una función `async` que recibe la instancia del servicio como `this`.

```js
const cds = require('@sap/cds');

module.exports = async function () {

    this.on('submitOrder', async (req) => {
        // lógica del handler / handler logic
    });

};
```

**Handlers de eventos**:
- Usar `this.on` para el handler principal de una operación o evento.
- Usar `this.before` para validaciones previas a la operación (no modificar datos aquí).
- Usar `this.after` para post-procesamiento o enriquecimiento de la respuesta.
- El parámetro `req` contiene los datos de entrada (`req.data`), el usuario (`req.user`) y los métodos de error (`req.error`, `req.reject`).
- **Obligatorio**: envolver siempre el cuerpo de cada handler con `try/catch`. En el `catch`, usar `req.error(err)` para propagarlo como error OData, o relanzar con `throw err` si el handler no tiene acceso a `req` (p.ej. `this.after`).

```js
this.before('CREATE', 'WorkOrders', async (req) => {
    try {
        if (!req.data.title) req.reject(400, 'El título es obligatorio / Title is required');
    } catch (err) {
        req.error(err);
    }
});

this.on('CREATE', 'WorkOrders', async (req) => {
    try {
        const { WorkOrders } = cds.entities;
        return await INSERT.into(WorkOrders).entries(req.data);
    } catch (err) {
        req.error(err);
    }
});

this.after('READ', 'WorkOrders', async (results) => {
    try {
        results.forEach(order => {
            order.isOverdue = order.dueDate < new Date();
        });
    } catch (err) {
        throw err;
    }
});
```

**Extracción a lib**: Toda lógica de negocio compleja debe extraerse al fichero `srv/lib/<nombreServicio>Lib.js` para mantener el fichero de servicio limpio y testeable.

## 6. Gestión de Datos

**CDS Queries**: Usar siempre las CQL queries nativas de CAP (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) en lugar de SQL directo o drivers externos.

```js
// Correcto / Correct
const orders = await SELECT.from(WorkOrders).where({ status: 'PENDING' });

// Evitar / Avoid
const orders = await db.run(`SELECT * FROM WorkOrders WHERE status = 'PENDING'`);
```

**Proyecciones**: Nunca usar `SELECT *` implícito cuando solo se necesitan campos específicos; declarar siempre las columnas necesarias para evitar transferencia innecesaria de datos.

```js
const titles = await SELECT.from(WorkOrders).columns('ID', 'title', 'status');
```

**Transacciones**: Usar `cds.tx` para agrupar operaciones que deben ejecutarse de forma atómica.

```js
await cds.tx(async (tx) => {
    await tx.run(INSERT.into(WorkOrders).entries(newOrder));
    await tx.run(UPDATE(Users).set({ orderCount: { '+=': 1 } }).where({ ID: userId }));
});
```

**Acceso a entidades**: Obtener las entidades con `cds.entities` o desestructurando desde el servicio; no hardcodear nombres de tabla.

```js
const { WorkOrders } = cds.entities;
```

## 7. Gestión de Errores

**Validaciones de negocio**: Usar `req.reject()` para errores que deben devolver un código HTTP específico y detener la ejecución del handler.

```js
if (!req.data.title) req.reject(400, 'El título es obligatorio / Title is required');
```

**Errores no críticos acumulables**: Usar `req.error()` para añadir mensajes de error sin detener el flujo (útil para validaciones múltiples en un `this.before`).

```js
if (!req.data.title) req.error(400, 'Título requerido / Title required');
if (!req.data.assignedTo) req.error(400, 'Asignado requerido / AssignedTo required');
```

**Errores inesperados**: En catch de operaciones externas (HTTP calls, etc.), relanzar siempre con `req.reject()` o lanzar un `Error` tipado; nunca swallow silently.

```js
try {
    const result = await externalService.call(payload);
    return result;
} catch (err) {
    req.reject(500, `Error llamando servicio externo: ${err.message} / Error calling external service: ${err.message}`);
}
```

**Logger**: Usar `cds.log('<módulo>')` en lugar de `console.log` en código de producción.

```js
const LOG = cds.log('work-order-service');
LOG.info('Procesando orden / Processing order', { orderId });
LOG.error('Error inesperado / Unexpected error', err);
```

## 8. Rendimiento

**Async/Await**: Todos los handlers deben ser `async`. Nunca bloquear el event loop con operaciones síncronas costosas.

**Consultas paralelas**: Cuando no existe dependencia entre consultas, ejecutarlas en paralelo con `Promise.all`.

```js
const [orders, users] = await Promise.all([
    SELECT.from(WorkOrders),
    SELECT.from(Users)
]);
```

**Evitar N+1**: No ejecutar queries dentro de bucles. Hacer una única query con JOIN o WHERE IN y luego procesar en memoria.

```js
// Evitar / Avoid
for (const order of orders) {
    order.user = await SELECT.one(Users).where({ ID: order.assignedTo_ID });
}

// Correcto / Correct
const userIds = orders.map(o => o.assignedTo_ID);
const users = await SELECT.from(Users).where({ ID: { in: userIds } });
```

**Operadores ternarios**: Siempre que la lógica condicional sea simple, usar el operador ternario en lugar de `if/else`.

```js
const sStatus = bActive ? 'ACTIVE' : 'INACTIVE';
```

**Refactorización**: Funciones con múltiples responsabilidades deben dividirse en funciones más pequeñas. Aplicar principio de responsabilidad única.

## 9. Convenciones de Nomenclatura (JavaScript)

Mantener la notación húngara para variables JS:
- `a` → Array (`aOrders`, `aResults`)
- `o` → Object (`oOrder`, `oUser`)
- `s` → String (`sStatus`, `sTitle`)
- `b` → Boolean (`bActive`, `bValid`)
- `i` → Integer (`iCount`, `iIndex`)
- `f` → Float (`fAmount`, `fTotal`)
- `p` → Promise (`pLoadData`)
- `fn` → Function/callback (`fnCallback`)

**Constantes**: `UPPER_SNAKE_CASE`. Centralizar en `srv/lib/constants.js` o al inicio del fichero si son locales al módulo.

```js
const MAX_RETRY_ATTEMPTS = 3;
const STATUS_PENDING = 'PENDING';
```

**Funciones privadas**: prefijo `_` + verbo + sustantivo (`_calculateOvertime`, `_validatePayload`).

**Funciones públicas** (exportadas en lib): verbo + sustantivo (`calculateOvertime`, `validatePayload`).

## 10. Testing

**Framework**: Jest (`@jest/globals` o `jest` directamente). Configuración en `jest.config.js` en la raíz del módulo.

**Pruebas unitarias de lib**: Testear las funciones de `srv/lib/` de forma aislada, sin levantar el servidor CAP.

```js
const horasExtraLib = require('../../srv/lib/horasExtraLib');

describe('horasExtraLib', () => {
    it('debe calcular correctamente horas extra con BHD / should correctly calculate overtime with BHD', async () => {
        const oLib = new horasExtraLib();
        const result = await oLib.condicion2HorasBHDCompensarTiempoLibre({ horas: 3, BHD: 2 });
        expect(result.nHorasPago).toBe(0);
    });
});
```

**Pruebas de integración de servicio**: Usar `cds.test()` para levantar el servidor CAP en memoria y ejecutar requests OData contra él.

```js
const cds = require('@sap/cds');

describe('WorkOrderService', () => {
    const { GET, POST } = cds.test(__dirname + '/../..');

    it('debe devolver lista de órdenes / should return list of orders', async () => {
        const { data } = await GET('/work-order-service/WorkOrders');
        expect(data.value).toBeDefined();
    });
});
```

**Cobertura**: Ejecutar `npm run test:coverage` para verificar cobertura. El objetivo mínimo es 70 % de las funciones de `srv/lib/`.

## 11. Seguridad

**Autenticación**: Anotar siempre el servicio con `@requires` en el fichero `.cds`. En local, configurar `"requires": { "auth": "mocked" }` en `package.json` para desarrollo.

**Validación de entradas**: Validar siempre los parámetros de entrada en `this.before` o al inicio del handler antes de operar con ellos. No confiar en que el cliente envía datos correctos.

**Secretos**: Nunca hardcodear credenciales, tokens o URLs de destino en el código. Usar variables de entorno o el servicio Destination de BTP.

**default-env.json**: Este fichero contiene credenciales locales y **nunca debe subirse al repositorio**. Asegurarse de que está en `.gitignore`.

## 12. Formateo de Código

**Tabulación (Tab Size)**: Todos los ficheros `.js` y `.cds` deben estar indentados con **Tab Size de 4**.

**Punto y coma**: Usar siempre punto y coma al final de cada sentencia JS.

**`"use strict"`**: No es obligatorio en módulos CAP (Node.js moderno), pero si se incluye en ficheros lib, debe ser consistente en todo el fichero.

## 13. Despliegue y Build

**Build CAP**: Antes de desplegar, ejecutar `npx cds build --production` para generar los artefactos en `gen/`.

**MTA**: El módulo de servicio en `mta.yaml` debe declarar el path apuntando a `gen/srv` (artefacto generado), no a `srv/` directamente.

**Comandos de build en `mta.yaml`**: El bloque `build-parameters.before-all` debe incluir `npm install` antes de `npx cds build --production`.

```yaml
build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm install
        - npx cds build --production
```

## 14. Control de Versiones

**GIT**: Se utilizará GIT como sistema de control de versiones.

**Commits**: La descripción del commit debe ser clara, concisa y explicar el **motivo** del cambio más que el cambio en sí.

**Nueva rama**: Antes de crear una nueva rama, realizar `git pull` para trabajar sobre la última versión y minimizar conflictos.

## 15. Conclusión
Siguiendo estas buenas prácticas, podrá desarrollar servicios CAP más robustos, seguros y fáciles de mantener, integrables con el ecosistema BTP.
