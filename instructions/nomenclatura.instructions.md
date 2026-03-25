---
applyTo: '**/*.cds,**/srv/**/*.js,**/db/**,**/gen/**'
---

# Convenciones de nomenclatura de SAP CAP
Este documento describe las convenciones de nomenclatura que se deben seguir al desarrollar servicios backend con SAP CAP (Cloud Application Programming Model) en Node.js. El cumplimiento de estas convenciones ayuda a mantener la coherencia y la claridad en el código fuente, lo que facilita la colaboración entre desarrolladores y la comprensión del trabajo de los demás.

## 1. Nombres de entidad CDS
**Formato**: `PascalCase`

**Descripción**: Los nombres de entidad deben estar en PascalCase y ser sustantivos en plural que describan el concepto de negocio. No añadir sufijos técnicos como `Entity` o `Table`.

Ejemplo:
- `WorkOrders` para la entidad de órdenes de trabajo.
- `Users` para la entidad de usuarios.
- `OvertimeRecords` para la entidad de registros de horas extra.

```cds
entity WorkOrders : cuid, managed {
    title      : String(100);
    status     : String(20);
    assignedTo : Association to Users;
}
```

## 2. Nombres de servicio CDS
**Formato**: `PascalCase` con sufijo `Service`

**Descripción**: Los servicios siempre deben terminar con el sufijo `Service` para indicar claramente su naturaleza. La ruta OData (`@path`) usa `kebab-case` y no debe incluir el sufijo `-service` si ya está implícito en el contexto de la URL.

Ejemplo:
- `WorkOrderService` para el servicio de órdenes de trabajo.
- `HorasExtraService` para el servicio de horas extra.

```cds
@path: 'work-order-service'
@requires: 'authenticated-user'
service WorkOrderService {
    entity WorkOrders as projection on db.WorkOrders;
}
```

## 3. Nombres de acciones y funciones CDS
**Formato**: `camelCase`

**Descripción**: Las acciones y funciones CDS deben nombrarse en camelCase con formato `verboSustantivo`. Se distinguen dos tipos:

- **`action`**: operación con efecto secundario (crea, modifica, elimina). Se invoca con HTTP POST.
- **`function`**: operación de solo lectura. Se invoca con HTTP GET.

El nombre debe describir claramente la operación que realiza.

Ejemplo:
- `submitOrder` — acción para enviar una orden.
- `calculateOvertime` — función para calcular horas extra.
- `validatePayload` — acción de validación.

```cds
service WorkOrderService {
    action  submitOrder(orderId : UUID) returns String;
    function calculateOvertime(userId : UUID, month : Integer) returns Decimal;
}
```

## 4. Nombres de tipos y aspectos CDS
**Formato**: `PascalCase`

**Descripción**: Los tipos personalizados y aspectos CDS deben estar en PascalCase. Los aspectos reutilizables (mixins) se nombran de forma que describan el comportamiento que aportan.

Ejemplo:
- `StatusType` para un tipo de estado.
- `Auditable` para un aspecto con campos de auditoría.
- `AddressInfo` para un tipo compuesto de dirección.

```cds
type StatusType : String enum {
    PENDING  = 'PENDING';
    APPROVED = 'APPROVED';
    REJECTED = 'REJECTED';
}

aspect Auditable {
    createdAt  : Timestamp;
    modifiedAt : Timestamp;
}
```

## 5. Nombres de campos de entidad
**Formato**: `camelCase`

**Descripción**: Los campos (propiedades) de las entidades CDS deben usar camelCase. Los campos clave generados por aspectos estándar de CAP (`cuid`, `managed`) siguen las convenciones del framework y no deben renombrarse.

Ejemplo:
- `firstName` para el nombre de un usuario.
- `assignedTo` para una asociación a otro usuario.
- `hoursWorked` para las horas trabajadas.

```cds
entity Users : cuid {
    firstName   : String(50);
    lastName    : String(50);
    hoursWorked : Decimal(5, 2);
}
```

## 6. Nombres de funciones JavaScript
**Formato**: `_verbNoun` (privadas) / `verbNoun` (públicas)

**Descripción**: Los nombres de las funciones deben ser descriptivos y seguir el formato `verboSustantivo`. Se distinguen dos casos:

- **Funciones privadas** (auxiliares internas del servicio o lib): comienzan con guion bajo (`_`). Se llaman desde otros handlers o funciones del mismo módulo.
- **Funciones públicas** (exportadas desde módulos `lib/`): sin prefijo `_`. Son las que consumen los ficheros de servicio.

Ejemplo:
- Función privada `_validatePayload(req)` para validar los datos de entrada de un handler.
- Función privada `_buildQuery(filters)` para construir una consulta CDS.
- Función pública `calculateOvertime(data)` exportada desde un módulo lib.
- Función pública `formatResponse(result)` para formatear la respuesta del servicio.

## 7. Nombres de handlers de eventos CAP
**Formato**: inline como arrow functions o funciones privadas con `_handle` + sustantivo

**Descripción**: Los handlers registrados con `this.on`, `this.before` y `this.after` son, en su mayoría, funciones inline. Cuando la lógica es suficientemente compleja para extraerse, la función privada debe usar el prefijo `_handle` o `_process` seguido del evento o entidad.

Ejemplo:
- Handler inline en `this.on('submitOrder', async (req) => { ... })`.
- Función extraída `_handleSubmitOrder(req)` cuando la lógica supera las 20 líneas.
- Función extraída `_processWorkOrderCreate(req)` para el handler de creación.

```js
module.exports = async function () {
    this.before('CREATE', 'WorkOrders', async (req) => {
        await this._validateWorkOrder(req);
    });

    this._validateWorkOrder = async (req) => {
        if (!req.data.title) req.reject(400, 'Título requerido / Title required');
    };
};
```

## 8. Nombres de propiedades JavaScript
**Formato**: `camelCase`

**Descripción**: Las propiedades de objetos JavaScript deben nombrarse usando camelCase para mantener la coherencia con las convenciones del lenguaje.

Ejemplo:
- `userName` para el nombre de un usuario.
- `isActive` para una propiedad booleana de estado activo.
- `createdAt` para la fecha de creación.

## 9. Nombres de variables
**Formato**: `camelCase` con prefijo de tipo (notación húngara)

**Descripción**: Los nombres de las variables deben usar camelCase. Deben ser lo suficientemente descriptivos para indicar su propósito; evitar nombres de una sola letra, excepto para contadores de bucle.

La primera letra del nombre de la variable debe corresponder al tipo de dato:
- Si el elemento de datos es `Boolean`, la variable comenzará con "b".
- Si el elemento de datos es `Integer`, la variable comenzará con "i".
- Si el elemento de datos es `Float`, la variable comenzará con "f".
- Si el elemento de datos es `String`, la variable comenzará con "s".
- Si el elemento de datos es `Object`, la variable comenzará con "o".
- Si el elemento de datos es un `Array`, la variable comenzará con "a".
- Si el elemento de datos es una `Date`, la variable comenzará con "d".
- Si el elemento de datos es una `Promise`, la variable comenzará con "p".
- Si el elemento de datos es una `Function` (callback almacenado en variable), la variable comenzará con "fn".

Ejemplo:
- `aOrders` para un array de órdenes de trabajo.
- `oUser` para un objeto de usuario.
- `sStatus` para un string de estado.
- `bValid` para un booleano de validación.
- `pLoadData` para una promesa de carga de datos.
- `fnCallback` para una función almacenada como callback.

## 10. Constantes
**Formato**: `UPPER_SNAKE_CASE`

**Descripción**: Las constantes deben nombrarse con letras mayúsculas y palabras separadas por guiones bajos. Esta convención ayuda a distinguir las constantes de las variables normales.
Las constantes de uso global deben declararse en `srv/lib/constants.js`. Las constantes locales a un único módulo pueden declararse al inicio del propio fichero.

Ejemplo:
- `MAX_RETRY_ATTEMPTS` para el número máximo de reintentos.
- `STATUS_PENDING` para el código de estado pendiente.
- `DEFAULT_PAGE_SIZE` para el tamaño de página por defecto.

```js
// srv/lib/constants.js
const MAX_RETRY_ATTEMPTS = 3;
const STATUS_PENDING     = 'PENDING';
const STATUS_APPROVED    = 'APPROVED';
const DEFAULT_PAGE_SIZE  = 50;

module.exports = { MAX_RETRY_ATTEMPTS, STATUS_PENDING, STATUS_APPROVED, DEFAULT_PAGE_SIZE };
```

## 11. Nombres de ficheros CDS
**Formato**: `camelCase.cds` para ficheros de servicio y modelo / `kebab-case.cds` para ficheros compartidos

**Descripción**: Los ficheros CDS siguen dos patrones según su ubicación:

- **`db/`**: ficheros de modelo de datos en `camelCase.cds` (p. ej., `schema.cds`, `types.cds`).
- **`srv/`**: el fichero de definición de servicio usa el mismo nombre base que su implementación JS, en `camelCase.cds` (p. ej., `workOrderService.cds`).

Regla: el fichero `.cds` del servicio y su implementación `.js` deben tener exactamente el mismo nombre base.

Ejemplo:
- `srv/workOrderService.cds` y `srv/workOrderService.js` para el servicio de órdenes.
- `srv/horasExtraService.cds` y `srv/horasExtraService.js` para el servicio de horas extra.
- `db/schema.cds` para el modelo de datos principal.
- `db/types.cds` para tipos CDS compartidos.

## 12. Nombres de ficheros de implementación y librería
**Formato**: `camelCase.js` para servicios e implementaciones / `PascalCase.js` para clases exportables

**Descripción**: Los ficheros dentro de `srv/` y `srv/lib/` siguen dos patrones según su naturaleza:

- **Servicios e implementaciones** (exportan un handler de CAP): `camelCase.js`.
- **Módulos con clase** (exportan una clase o constructor principal): `PascalCase.js`.
- **Módulos funcionales** (exportan un conjunto de funciones sueltas): `camelCase.js`.

Ejemplo:
- `horasExtraService.js` — implementación del servicio (camelCase).
- `horasExtraLib.js` — librería funcional de negocio (camelCase).
- `constants.js` — módulo de constantes (camelCase).
- `ErrorHandler.js` — clase de gestión de errores (PascalCase).

## 13. Nombres de rutas OData (`@path`)
**Formato**: `kebab-case`

**Descripción**: El valor de la anotación `@path` en la definición CDS del servicio debe estar en `kebab-case`, ser breve y describir el dominio funcional. No incluir versión en la ruta salvo que el proyecto requiera versionado explícito de API.

Ejemplo:
- `@path: 'work-order-service'` para el servicio de órdenes de trabajo.
- `@path: 'horas-extra'` para el servicio de horas extra.
- `@path: 'shift-change'` para el servicio de cambio de turno.

```cds
@path: 'horas-extra'
service HorasExtraService { ... }
```

## 14. Ficheros de test
**Formato**:
- Tests unitarios de lib: `[nombreLib].test.js`
- Tests de integración de servicio: `[nombreServicio].dynamic.test.js`

**Descripción**: Los ficheros de test deben ubicarse junto al fichero que testean o en una carpeta `test/` dentro del módulo y seguir la estructura:

```
srv/
  horasExtraService.cds
  horasExtraService.js
  horasExtraService.dynamic.test.js   ← integración con cds.test()
  lib/
    horasExtraLib.js
    horasExtraLib.test.js              ← unitario de lib
  test-data/
    horasExtraServiceCases.js          ← datos de prueba compartidos
```

- Los tests unitarios de `lib/` testean las funciones de negocio de forma aislada, sin levantar el servidor CAP.
- Los tests de integración usan `cds.test()` para levantar el servidor en memoria y ejecutar requests OData reales.
- Los ficheros de datos de prueba se nombran `[nombreServicio]Cases.js` y se ubican en `test-data/`.

Ejemplo de nombre:
- `horasExtraLib.test.js` — test unitario de la librería de horas extra.
- `horasExtraService.dynamic.test.js` — test de integración del servicio.
- `horasExtraServiceCases.js` — datos de prueba del servicio.