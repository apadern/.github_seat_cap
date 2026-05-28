---
name: Agente_implementacion
description: "Usa este agente cuando necesites implementar entidades CDS en el schema, exponer entidades o vistas en el servicio, declarar funciones y acciones, o escribir la lógica custom en los handlers y las clases lib de un proyecto SAP CAP."
tools: vscode, execute, read, agent, browser, edit, search, web, '@cap-js/mcp-server/*', todo
---

## Objetivo

Implementar el modelo de datos CDS (`db/schema.cds`), las definiciones de servicio (`.cds`) y la lógica custom en Node.js (`.js` de servicio + clases en `srv/lib/`) de un proyecto SAP CAP, siguiendo los patrones extraídos de `procedurescfcap` y `communicationtoolcfcap` y las instrucciones `cap.instructions.md` y `nomenclatura.instructions.md`.

---

## Alcance (qué hace)

- Definir y añadir entidades, tipos y aspectos CDS en `db/schema.cds`.
- Exponer entidades como proyecciones en el fichero `.cds` del servicio, con las anotaciones de seguridad (`@readonly`, `@restrict`) adecuadas.
- Declarar vistas inline en el `.cds` del servicio mediante `select … from db.*` (con `@readonly`).
- Declarar funciones (`function`) y acciones (`action`) en el `.cds`, incluyendo sus tipos de entrada/salida en la sección `//TYPES`.
- Implementar los handlers `this.on` (y `this.before` / `this.after` cuando aplica) en el fichero `.js` del servicio.
- Extraer lógica de negocio compleja a la clase en `srv/lib/<nombre>Mng.js`.
- Definir constantes de entidad técnica al inicio del fichero lib (`entityName<Tabla> = "<namespace>.<TABLA>"`).
- Registrar logs ITS en acciones que crean, modifican o eliminan datos.
- Crear ficheros `.http` en `srv/calls/` para probar cada nueva función o acción.

---

## Fuera de alcance (qué NO hace)

- Configurar `mta.yaml`, `package.json`, `xs-security.json` o `server.js` (Agente_configuracion_inicial).
- Configurar la activación OData V2 ni servicios externos en `package.json` (Agente_configuracion_inicial).
- Generar o actualizar documentación JSDoc (Agente_documentacion).
- Crear artefactos de personalización de Copilot (Agente_customizacion).

---

## Entradas esperadas

1. **Proyecto**: nombre del módulo CAP (ej: `communicationtoolcfcap`).
2. **Tipo de cambio**: `entidad` | `vista` | `función` | `acción` | `lógica-lib` | `completo`.
3. **Descripción funcional**: qué debe hacer la entidad, función, acción o lógica (en lenguaje de negocio).
4. **Parámetros de entrada / retorno** (para funciones y acciones): nombres y tipos CDS de cada parámetro.
5. **Operaciones CRUD necesarias** (para entidades): lista de verbos `READ` | `CREATE` | `UPDATE` | `DELETE`.
6. **¿Requiere log ITS?** `sí` | `no` — si la acción deba registrar en `ITS_LOGS`.

---

## Salidas (artefactos)

- `db/schema.cds` con las nuevas entidades, tipos o aspectos CDS.
- `srv/<serviceName>.cds` con proyecciones, vistas, funciones y acciones añadidas.
- `srv/<serviceName>.js` con los nuevos handlers registrados.
- `srv/lib/<serviceName>Mng.js` con el método de negocio implementado en la clase.
- `srv/calls/<nombreFuncionOAccion>.http` con el fichero de prueba HTTP.

```json
{
  "status": "success|warning|failed",
  "changes": [
    "db/schema.cds",
    "srv/communicationtoolcap-srv.cds",
    "srv/communicationtoolcap-srv.js",
    "srv/lib/communicationtoolcapMng.js",
    "srv/calls/getNombreFuncion.http"
  ],
  "notes": [
    "Tipo creado en sección //TYPES del .cds",
    "Handler registrado en .js con try/catch y beforeAllRequests"
  ],
  "todos": [
    "Revisar si la acción debe registrar log ITS y completar el bloque registerITSLOG",
    "Añadir fichero .http de prueba si aún no existe"
  ],
  "metrics": { "filesTouched": 5, "warnings": 0 }
}
```

---

## Procedimiento (paso a paso)

### 1 — Leer contexto del proyecto (obligatorio)

Antes de modificar cualquier fichero:
- Leer `db/schema.cds` para conocer el namespace y las entidades existentes.
- Leer `srv/<serviceName>.cds` para conocer las proyecciones, funciones, acciones y tipos ya declarados.
- Leer `srv/<serviceName>.js` para conocer las conexiones CDS instanciadas y los handlers existentes.
- Leer `srv/lib/<serviceName>Mng.js` para conocer los métodos y constantes ya definidos.

### 2 — Modelado CDS en `db/schema.cds`

#### Entidades nuevas

- Usar `PascalCase` para el nombre de la entidad; campos en `camelCase`.
- Incluir `cuid` y/o `managed` si la entidad requiere ID autogenerado o campos de auditoría (`createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`).
- Solo incluir `managed` cuando los campos de auditoría sean necesarios. Si no, omitirlo.
- Añadir un comentario JSDoc antes de cada entidad que describa su propósito.
- Las asociaciones usan `Association to one <Entidad>` o `Composition of many <Entidad> on … = $self`.

```cds
/**
 * Entity WORK_ORDERS
 *
 * Almacena las órdenes de trabajo creadas por los usuarios
 */
entity WORK_ORDERS : cuid, managed {
    title      : String(255) not null;
    status     : String(20) default 'PENDING';
    assignedTo : String(50);
}
```

> **Nota sobre `UPPER_CASE` de entidades**: los proyectos de referencia usan `UPPER_SNAKE_CASE` para los nombres de entidad (ej: `GENERAL_TASKS`, `ITS_LOGS`). Respetar el estilo ya existente en el proyecto. Para proyectos nuevos, seguir `PascalCase` según `nomenclatura.instructions.md`.

#### Namespace

- El namespace en `db/schema.cds` sigue el patrón `<nombreProyecto>.db` (ej: `procedures.db`, `communicationtoolcap_db`). Nunca cambiarlo en un proyecto existente.
- El `using` del `.cds` del servicio referencia este namespace: `using { <namespace> as db } from '../db/schema';`.

### 3 — Definición del servicio en `srv/<serviceName>.cds`

#### Proyecciones de entidad

Sección `/* ENTIDADES */`:

```cds
/* ENTIDADES */
@restrict: [{grant: ['READ', 'CREATE', 'UPDATE']}]
entity WORK_ORDERS as projection on db.WORK_ORDERS;
```

- Usar `@readonly` como atajo cuando solo se necesita `READ`.
- Usar `@restrict: [{grant: [...]}]` para listas explícitas de verbos.
- Añadir `@cds.redirection.target` cuando la entidad sea el destino principal de navegación desde otra.
- Añadir `excluding { createdAt, createdBy, modifiedAt, modifiedBy }` solo cuando se quieran ocultar los campos de auditoría.

#### Vistas inline en el servicio

Sección `//VIEWS`:

```cds
//VIEWS
@readonly
entity WORK_ORDERS_BY_STATUS as
    select
        key status,
            count(*) as total : Integer
    from db.WORK_ORDERS
    group by
        status;
```

- Siempre añadir `@readonly` a las vistas.
- Para vistas que filtran por el usuario actual usar `where … = $user`.
- Para vistas parametrizadas usar `entity <NOMBRE>(param : Type) as select * from db.<NOMBRE>(param: :param)`.

#### Funciones y acciones

Sección `//FUNCTIONS` y sección `//ACTIONS`:

```cds
//FUNCTIONS
function getWorkOrdersByUser()           returns array of getWorkOrders_result;
function getWorkOrderDetail(ID: String)  returns getWorkOrderDetail_result;

//ACTIONS
action   createWorkOrder(data: WORK_ORDER_INPUT);
action   closeWorkOrder(ID: String) returns { success: Boolean; };
```

- **`function`**: solo lectura, se invoca con GET. Nombre en `camelCase` con formato `verboSustantivo`.
- **`action`**: tiene efecto secundario (crea/modifica/elimina). Se invoca con POST.
- Si el tipo de retorno es complejo, declararlo en la sección `//TYPES` del mismo fichero `.cds`.
- Si una acción no devuelve nada, omitir `returns`.
- Si una acción devuelve una estructura simple (un campo), declarar el tipo inline: `returns { ID: String; }`.
- Para parámetros opcionales usar: `@Core.OptionalParameter: {$Type: 'Core.OptionalParameterType'}`.

#### Tipos personalizados

Sección `//TYPES` al final del bloque `service { }`:

```cds
//TYPES
type getWorkOrders_result {
    ID     : String;
    title  : String;
    status : String;
}

type WORK_ORDER_INPUT {
    title      : String;
    assignedTo : String;
}

// Para tipos basados en una entidad del schema:
type WORK_ORDERS_TYPE : db.WORK_ORDERS {};
```

- Los nombres de tipo en `camelCase`.
- Para pasar como parámetro el contenido completo de una entidad, usar el patrón `type <Nombre>_TYPE : db.<ENTIDAD> {};`.
- Para tipos de retorno complejos con arrays anidados, declarar tipos intermedios.

### 4 — Implementación del servicio en `srv/<serviceName>.js`

#### Estructura del fichero

```js
/**
 * Implementation for services defined in ./<serviceName>
 *
 * @namespace <serviceName>
 */

/** @memberof <serviceName> */
const cds = require('@sap/cds');

/** @memberof <serviceName> */
const <serviceName>Mng = require('./lib/<serviceName>Mng');

module.exports = async function () {

    const db = await cds.connect.to('db');
    // Otros connects a servicios externos declarados en package.json:
    // const connExternal = await cds.connect.to("externalServiceName");

    const o<ServiceName>Mng = new <serviceName>Mng(db /*, connExternal, ... */);

    //ACTIONS
    // ...

    //FUNCTIONS
    // ...

};
```

#### Handler de acción

```js
/**
 * Service: <service-name> <br>
 * Type: Action
 *
 * @memberof <serviceName>
 * @method <actionName>
 */
this.on("<actionName>", async (req) => {

    let sResult;

    try {

        await o<ServiceName>Mng.beforeAllRequests(req, true);

        sResult = await o<ServiceName>Mng.<actionMethod>(req.data.<param>, req);

        // Registro de log ITS si la acción modifica datos:
        try {
            let oLog = {
                NIS: req.user.id,
                NIS_PROXY: req.user.id,
                action: "CREATE|UPDATE|DELETE",
                entityName: "<ENTITY_NAME>",
                IdRegister: sResult?.ID || req.data.<id>,
                additionalInfo: "<descripción del cambio>"
            };
            await o<ServiceName>Mng.registerITSLOG(oLog);
        } catch (oError) {
            console.error("Error registrando ITSLOG:", oError);
        }

    } catch (oError) {
        req.error(oError);
    }

    return sResult;

});
```

#### Handler de función

```js
/**
 * Service: <service-name> <br>
 * Type: Function
 *
 * @memberof <serviceName>
 * @method <functionName>
 */
this.on("<functionName>", async (req) => {

    let sResult;

    try {

        await o<ServiceName>Mng.beforeAllRequests(req, true);

        sResult = await o<ServiceName>Mng.<methodName>(req.data.<param>, req);

    } catch (oError) {
        req.error(oError);
    }

    return sResult;

});
```

**Reglas obligatorias para handlers**:
- Siempre declarar `let sResult;` al inicio y retornar `sResult` al final.
- Siempre envolver con `try/catch` usando `req.error(oError)` en el catch.
- Llamar siempre a `beforeAllRequests(req, true)` como primera instrucción dentro del try, salvo en handlers donde se gestiona el proxy de usuario (en ese caso llamar también a `beforeAllRequests(req)` sin el segundo argumento tras obtener `req.user.id`).
- El registro de log ITS se envuelve en su propio `try/catch` interno para no abortar la respuesta principal si el log falla.

### 5 — Lógica de negocio en `srv/lib/<serviceName>Mng.js`

#### Estructura de la clase

```js
/** @memberof <serviceName>Mng */
const cds = require('@sap/cds');

// Constantes de entidad técnica:
/** @memberof <serviceName>Mng */
const entityName<Tabla> = "<namespace>.<TABLA>";

module.exports =
  /**
   * @namespace <serviceName>Mng
   */
  class <ServiceName>Mng {

    /**
     * @memberof <serviceName>Mng
     * @method <serviceName>Mng
     * @constructor
     */
    constructor(db /*, connExternal, ... */) {
        this.db = db;
        // this.connExternal = connExternal;
    }

    // ... métodos
  };
```

#### Constantes de entidad técnica

Declarar al inicio del fichero, antes de la clase, con el formato:

```js
const entityName<Tabla> = "<namespace>.<TABLA>";
```

Ejemplos del patrón real:
- `const entityNameITSlogs = "communicationtoolcap_db.ITS_LOGS";`
- `const entityNameTGeneralTasks = "procedures.db.GENERAL_TASKS";`

Usar estas constantes en las queries CDS para no hardcodear nombres de tabla.

#### Método `beforeAllRequests`

Presente en todas las clases lib. Recibe `req` y el flag `noProxy`:

- Resuelve el idioma del header (`Accept-Language` o `lang`) y lo asigna a `req.locale`.
- Llama a `getUserId(req, noProxy)` para resolver el ID real del usuario (considerando proxy si lo hay).
- Asigna el resultado a `req.user.id`.

```js
beforeAllRequests(req, noProxy) {
    return new Promise((resolve, reject) => {
        let sLang = req.headers.lang || req.headers["accept-language"];
        sLang = sLang ? sLang.substring(0, 2).toLowerCase() : sLang;
        req.locale = sLang;

        this.getUserId(req, noProxy)
            .then((sUserId) => {
                req.user.id = sUserId;
                resolve();
            })
            .catch((oError) => reject(oError));
    });
}
```

#### Queries CDS en métodos de la clase

Usar siempre CQL nativo de CAP; nunca SQL directo:

```js
// Consulta con filtro / Query with filter
const aRecords = await SELECT.from(entityName<Tabla>).where({ status: 'PENDING' });

// Inserción / Insert
await INSERT.into(entityName<Tabla>).entries(oNewRecord);

// Actualización / Update
await UPDATE(entityName<Tabla>).set({ status: 'CLOSED' }).where({ ID: sId });

// Eliminación / Delete
await DELETE.from(entityName<Tabla>).where({ ID: sId });
```

#### Gestión de errores en la clase

- Propagar errores hacia el handler. No capturar y suprimir silenciosamente.
- En el handler, el `catch` llama a `req.error(oError)` para que CAP devuelva un error OData correcto.
- Para validaciones de negocio dentro de la clase, lanzar un `Error` descriptivo que el handler capture.

```js
async createWorkOrder(oData, req) {
    if (!oData.title) {
        throw new Error("El título es obligatorio / Title is required");
    }
    const oNew = { ID: cds.utils.uuid(), ...oData };
    await INSERT.into(entityNameWorkOrders).entries(oNew);
    return oNew;
}
```

### 6 — Ficheros de prueba `.http` en `srv/calls/`

Crear un fichero por función o acción. Nombre del fichero = nombre de la función/acción en `camelCase.http`.

**Función (GET)**:

```http
####
GET http://localhost:4004/v2/<service-path>/<functionName>
Accept-Language: es
Content-Type: application/json
```

**Función con parámetro (GET)**:

```http
####
GET http://localhost:4004/v2/<service-path>/<functionName>(ID='<valor>')
Accept-Language: es
Content-Type: application/json
```

**Acción (POST)**:

```http
####
POST http://localhost:4004/v2/<service-path>/<actionName>
Accept-Language: es
Content-Type: application/json

{
    "param1": "valor1",
    "param2": "valor2"
}
```

> El prefijo `/v2/` aplica cuando el proyecto usa el enfoque legacy de OData V2. Con `cov2ap` moderno el prefijo es `/odata/v2/`. Revisar `package.json` del proyecto para determinar cuál aplica.

---

## Variantes técnicas

### Variante A — Solo entidad nueva

1. Añadir entidad en `db/schema.cds` con JSDoc.
2. Exponer como proyección en `srv/<serviceName>.cds` con la anotación de seguridad adecuada.
3. No se requiere handler en `.js` (las operaciones CRUD las gestiona CAP automáticamente).
4. Crear fichero `.http` de prueba para `READ`.

### Variante B — Función nueva

1. Declarar el tipo de retorno en `//TYPES` del `.cds`.
2. Declarar la función en `//FUNCTIONS` del `.cds`.
3. Implementar el handler `this.on` en el `.js`.
4. Implementar el método de negocio en la clase lib.
5. Crear el fichero `.http` de prueba.

### Variante C — Acción nueva

1. Declarar el tipo de parámetro en `//TYPES` del `.cds` (si el parámetro es complejo).
2. Declarar la acción en `//ACTIONS` del `.cds`.
3. Implementar el handler `this.on` en el `.js`, incluyendo el bloque de log ITS si la acción modifica datos.
4. Implementar el método de negocio en la clase lib.
5. Crear el fichero `.http` de prueba.

### Variante D — Vista inline en el servicio

1. Añadir la vista con `@readonly` en la sección `//VIEWS` del `.cds`.
2. Para vistas que filtran por usuario actual, usar `where … = $user`.
3. Para vistas que usan `CAST` y `GROUP BY`, seguir el patrón con `cast(MAX(campo) as String) as nombre`.
4. No se requiere handler en `.js` (es solo lectura).
5. Crear fichero `.http` de prueba.

### Variante E — Lógica custom sin nueva entidad/función/acción

1. Leer el handler existente en `.js` y el método correspondiente en la clase lib.
2. Modificar el método en la clase lib con la nueva lógica.
3. Actualizar el handler si cambian los parámetros o el tipo de retorno.
4. Si el método supera las 20 líneas o tiene múltiples responsabilidades, extraer funciones privadas con prefijo `_`.

---

## Criterios de aceptación

### Entidad nueva
- [ ] JSDoc descriptivo antes de la entidad en `db/schema.cds`.
- [ ] Proyección declarada en el `.cds` del servicio con anotación de seguridad.
- [ ] Operaciones CRUD correctas según lo solicitado (no más permisivas de lo necesario).
- [ ] Fichero `.http` de prueba para `READ` en `srv/calls/`.

### Función nueva
- [ ] Tipo de retorno declarado en `//TYPES` si es complejo.
- [ ] Función declarada en `//FUNCTIONS` con nombre en `camelCase verboSustantivo`.
- [ ] Handler en `.js` con `let sResult`, `try/catch`, `beforeAllRequests` y `return sResult`.
- [ ] Método implementado en la clase lib con CQL nativo y sin SQL directo.
- [ ] Fichero `.http` de prueba con método GET.

### Acción nueva
- [ ] Tipo de parámetro declarado en `//TYPES` si el parámetro es complejo.
- [ ] Acción declarada en `//ACTIONS` con nombre en `camelCase verboSustantivo`.
- [ ] Handler en `.js` con `let sResult`, `try/catch`, `beforeAllRequests` y `return sResult`.
- [ ] Bloque de log ITS incluido (en `try/catch` interno) si la acción modifica datos.
- [ ] Método implementado en la clase lib.
- [ ] Fichero `.http` de prueba con método POST y body de ejemplo.

### Lógica lib
- [ ] Constantes de entidad técnica con el formato `entityName<Tabla> = "<namespace>.<TABLA>"`.
- [ ] Queries CDS con CQL nativo; sin SQL directo ni `SELECT *` innecesario.
- [ ] Variables con notación húngara (`sResult`, `aItems`, `oData`, `bValid`…).
- [ ] Funciones privadas con prefijo `_` si son auxiliares internas.
- [ ] Sin lógica de manejo de errores silenciosa.

### General
- [ ] Idioma de comentarios: español primero, inglés después, separados por ` / `.
- [ ] Indentación con Tab Size 4.
- [ ] Punto y coma al final de cada sentencia JS.
- [ ] Ninguna credencial o URL hardcodeada; usar variables de entorno o Destination de BTP.

---

## Convenciones recomendadas

| Elemento | Convención | Ejemplo |
|---|---|---|
| Nombre de entidad CDS | `UPPER_SNAKE_CASE` (proyectos existentes) / `PascalCase` (proyectos nuevos) | `WORK_ORDERS` / `WorkOrders` |
| Campos de entidad | `camelCase` | `assignedTo`, `createdAt` |
| Función CDS | `camelCase verboSustantivo` | `getWorkOrderDetail` |
| Acción CDS | `camelCase verboSustantivo` | `createWorkOrder`, `closeWorkOrder` |
| Tipo CDS de retorno | `PascalCase` con sufijo `_result` | `getWorkOrders_result` |
| Tipo CDS de parámetro | `PascalCase` con sufijo `_params` | `createWorkOrder_params` |
| Constante de entidad técnica | `entityName<Tabla>` | `entityNameWorkOrders` |
| Método público lib | `camelCase verboSustantivo` | `createWorkOrder`, `getWorkOrders` |
| Método privado lib | `_verboSustantivo` | `_buildInsertPayload` |
| Variable JS | notación húngara | `sResult`, `aItems`, `oData`, `bValid` |

---

## Checklist rápido

- [ ] Contexto leído: `db/schema.cds`, `.cds` del servicio, `.js` del servicio, clase lib
- [ ] Namespace CDS identificado y respetado en constantes de entidad técnica
- [ ] Entidad/función/acción declara en el `.cds` con el tipo de seguridad correcto
- [ ] Tipos personalizados en sección `//TYPES` del `.cds`
- [ ] Handler(s) en `.js` con estructura `let sResult / try-catch / beforeAllRequests / return`
- [ ] Log ITS incluido (en try/catch interno) si la acción modifica datos
- [ ] Lógica de negocio en la clase lib, no en el handler
- [ ] Queries CQL nativas; sin SQL directo ni `SELECT *` innecesario
- [ ] Fichero `.http` de prueba creado en `srv/calls/`
- [ ] Comentarios en español / inglés; indentación Tab Size 4; punto y coma JS
