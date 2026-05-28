www---
applyTo: '**/*.cds,**/srv/**/*.js,**/db/**,**/gen/**'
---

# Convenciones de nomenclatura de SAP CAP
Este documento define reglas de nomenclatura para CAP y evita duplicar directrices generales de implementación, seguridad, testing o despliegue.

## 1. Entidades CDS
- Formato: `PascalCase`.
- Deben ser nombres de dominio claros; evitar sufijos técnicos como `Entity` o `Table`.

Ejemplo:
```cds
entity WorkOrders : cuid, managed {
    title      : String(100);
    status     : String(20);
    assignedTo : Association to Users;
}
```

## 2. Servicios CDS
- Formato: `camelCase` con sufijo `Service`.
- La anotación `@path` usa `kebab-case`.

Ejemplo:
```cds
@path: 'work-order-service'
service workOrderService {
    entity WorkOrders as projection on db.WorkOrders;
}
```

## 3. Acciones y funciones CDS
- Formato: `camelCase` con patrón `verboSustantivo`.
- `action` para operaciones con efecto secundario.
- `function` para operaciones de lectura.

Ejemplo: `submitOrder`, `calculateOvertime`, `validatePayload`.

## 4. Tipos y aspectos CDS
- Formato: `camelCase`.
- Deben nombrar claramente el concepto o comportamiento reutilizable.

Ejemplo: `statusType`, `auditable`, `addressInfo`.

## 5. Campos de entidad
- Formato: `camelCase`.
- No renombrar campos estándar de CAP introducidos por `cuid` y `managed`.

Ejemplo: `firstName`, `assignedTo`, `hoursWorked`.

## 6. Funciones JavaScript
- Privadas: `_verbNoun`.
- Públicas exportadas: `verbNoun`.

Ejemplo: `_validatePayload(req)`, `calculateOvertime(data)`.

## 7. Handlers CAP
- Handlers simples inline con `this.on`, `this.before`, `this.after`.
- Si se extraen, usar prefijos `_handle` o `_process`.

Ejemplo: `_handleSubmitOrder(req)`, `_processWorkOrderCreate(req)`.

## 8. Propiedades JavaScript
- Formato: `camelCase`.

Ejemplo: `userName`, `isActive`, `createdAt`.

## 9. Variables JavaScript (notación húngara)
- `a` array, `o` object, `s` string, `b` boolean, `i` integer, `f` float, `d` date, `p` promise, `fn` function.

Ejemplo: `aOrders`, `oUser`, `sStatus`, `bValid`, `pLoadData`, `fnCallback`.

## 10. Constantes
- Formato: `UPPER_SNAKE_CASE`.
- Globales en `srv/lib/constants.js`; locales al inicio del módulo.

Ejemplo: `MAX_RETRY_ATTEMPTS`, `STATUS_PENDING`, `DEFAULT_PAGE_SIZE`.

## 11. Nombres de ficheros CDS
- Formato: `camelCase.cds`.
- En `srv/`, el `.cds` y su `.js` asociado deben compartir el mismo nombre base.

Ejemplo: `srv/horasExtraService.cds` y `srv/horasExtraService.js`.

## 12. Nombres de ficheros JS
- Servicios y módulos funcionales: `camelCase.js`.

Ejemplo: `horasExtraService.js`, `horasExtraLib.js`.

## 12.1. Definición y exportación de clases JS
- Las clases se exportan directamente con `module.exports =` seguido del bloque JSDoc y la declaración `class`.
- El nombre de la clase usa `camelCase` y debe describir el ámbito del servicio o módulo que gestiona.

```js
module.exports =

    /**
     * Se exportan los métodos que va a utilizar el fichero proceduresService.js
     * para realizar las operaciones de las funciones/acciones para el servicio
     * procedures-service-ext
     *
     * @namespace proceduresExtMng
     */
    class proceduresExtMng {
        // ...
    };
```

## 13. Rutas OData (`@path`)
- Formato: `kebab-case`.
- Deben ser breves y orientadas al dominio.

Ejemplo: `@path: 'horas-extra'`.

## 14. Ficheros de test
- Unitarios de librería: `[nombreLib].test.js`.
- Integración de servicio: `[nombreServicio].dynamic.test.js`.
- Datos de prueba: `[nombreServicio]Cases.js`.

## 15. Códigos de error en `req.error` y `req.reject`
- Formato: `UPPER_SNAKE_CASE`, sin espacios.
- Deben ser códigos técnicos reconocibles y traducibles desde el front.
- No usar mensajes literales en lenguaje natural directamente.

```js
// ❌ Mal: mensaje literal no traducible
req.error(400, 'El proyecto no existe');

// ✅ Bien: código técnico traducible desde front
req.error(400, 'PROJECT_NOT_FOUND');
req.reject(403, 'USER_NOT_AUTHORIZED');
req.error(422, 'INVALID_BUDGET_AMOUNT');
```
