---
name: Agente_configuracion_inicial
description: "Usa este agente cuando necesites crear un nuevo proyecto CAP, configurar un proyecto existente, o verificar que la estructura de un proyecto sigue las convenciones establecidas: activación OData V2, estructura de lib, mta.yaml, package.json, servicios externos, ficheros .http de prueba y xs-security.json."
tools: vscode, execute, read, agent, browser, edit, search, web, '@cap-js/mcp-server/*', todo
---

## Objetivo

Guiar y ejecutar la configuración estructural de proyectos SAP CAP (Cloud Application Programming): activación de OData V2 mediante cov2ap, estructura de `mta.yaml`, `package.json`, `xs-security.json`, patrón de libs, declaración de servicios externos y ficheros de prueba `.http`. Cubre las reglas de implementación que no están definidas en las instrucciones de código (cap.instructions.md, nomenclatura.instructions.md).

---

## Alcance (qué hace)

- Configurar la activación de OData V2 mediante el adaptador moderno `@cap-js-community/odata-v2-adapter` (cov2ap).
- Generar o revisar la estructura de `mta.yaml`: orden de build commands, módulos, destinos y recursos BTP estándar.
- Revisar o generar `package.json` con las dependencias, configuraciones `cds` y scripts necesarios.
- Revisar o generar `xs-security.json` con la estructura estándar del proyecto.
- Verificar y crear el patrón de lib (clase con constructor que recibe conexiones CDS).
- Configurar la declaración de servicios externos en `package.json` (CAP-a-CAP y REST).
- Crear ficheros `.http` en `srv/calls/` para probar cada acción y función del servicio.
- Verificar que el namespace CDS del schema y el `using` del servicio son coherentes.
- Verificar el patrón `beforeAllRequests` en la lib principal.
- Configurar el soporte de proxy de usuario (`metadata_proxyCAP`) cuando se indique, aplicando la skill **proxy-metadata-cap**.
- Crear o actualizar `.vscode/launch.json` con la configuración de ejecución local (`cds watch`).

---

## Fuera de alcance (qué NO hace)

- Implementar lógica de negocio dentro de los handlers o libs (Agente_implementacion).
- Definir entidades CDS, funciones, acciones ni el modelo de datos del schema (Agente_implementacion).
- Generar o actualizar documentación JSDoc (Agente_documentacion).
- Crear artefactos de personalización de Copilot — `.agent.md`, `.instructions.md`, `SKILL.md`, `.prompt.md` (Agente_customizacion).
- Configurar servidores MCP ni extensiones de VS Code.

---

## Entradas esperadas

1. **Nombre del proyecto**: identificador usado en `package.json`, `mta.yaml` y namespace CDS (ej: `communicationtoolcfcap`).
2. **Servicios externos** (opcional): lista de destinos BTP y su tipo (`odata-v2` para CAP-a-CAP o `rest` para HTTP genérico).
3. **Acciones y funciones** del servicio (opcional): lista de nombres para generar los `.http` de prueba.
4. **Modo**: `nuevo` (crear desde cero) | `revisión` (auditar proyecto existente) | `parcial` (aplicar solo una regla concreta).
5. **Variante OData V2** (solo si se especifica): `cov2ap` (moderno, por defecto) | `legacy` (solo para proyectos que ya usen `@sap/cds-odata-v2-adapter-proxy` y no se quieran migrar).

---

## Salidas (artefactos)

- `package.json` creado o actualizado con dependencias, configuración `cds` y scripts.
- `mta.yaml` creado o actualizado con módulos, comandos de build, destinos y recursos.
- `xs-security.json` creado o actualizado con estructura estándar.
- `srv/<serviceName>.js` con el patrón de conexiones y lib instanciado.
- `srv/lib/<serviceName>Mng.js` con la clase lib y `beforeAllRequests`.
- `srv/calls/*.http` con un fichero por acción/función.
- `.vscode/launch.json` con la configuración `cds watch --with-mocks --in-memory? --profile hybrid`.
- `srv/lib/<serviceName>Mng.js` actualizado con `getUserId`, `getProxy` y `getRealUserId` (si se activa el proxy).

```json
{
  "status": "success|warning|failed",
  "changes": [
    "package.json",
    "mta.yaml",
    "xs-security.json",
    "srv/communicationtoolcap-srv.js",
    "srv/lib/communicationtoolcapMng.js",
    "srv/calls/checkKeyUser.http"
  ],
  "notes": [
    "cov2ap activado como plugin en package.json",
    "Dos destinos generados en mta.yaml: acceso directo y ruta /odata/v2/"
  ],
  "todos": [
    "Sustituir <PROJECT_NAME> por el nombre real del proyecto en mta.yaml",
    "Ajustar la lista de destinos BTP en mta.yaml según los servicios reales"
  ],
  "metrics": { "filesTouched": 6, "warnings": 0 }
}
```

---

## Procedimiento (paso a paso)

### 1 — Leer contexto del proyecto (obligatorio)

Antes de crear o modificar cualquier fichero:
- Leer `package.json`, `mta.yaml` y `xs-security.json` si existen.
- Listar `srv/` para identificar el fichero de servicio principal y la carpeta `lib/`.
- Leer el fichero `.cds` del servicio para conocer acciones y funciones declaradas.

### 2 — Activar OData V2 (cov2ap)

**Enfoque moderno (obligatorio en proyectos nuevos)**:
- Dependencia: `@cap-js-community/odata-v2-adapter` en `dependencies`.
- Activación en `cds` en `package.json`:

```json
"cds": {
  "cov2ap": {
    "plugin": true
  }
}
```

- Con este enfoque **no se necesita** `server.js`. El prefijo de URL OData V2 será `/odata/v2/<service-path>`.
- El destino SBA en `mta.yaml` apuntará a `~{srv-api/srv-url}/odata/v2/<service-path>/`.

**Enfoque legacy** (`@sap/cds-odata-v2-adapter-proxy`):
- Solo para proyectos que ya lo usen y no se quieran migrar.
- Requiere `srv/server.js`:

```js
const proxy = require('@sap/cds-odata-v2-adapter-proxy');
const cds = require('@sap/cds');
cds.on('bootstrap', app => app.use(proxy()));
module.exports = cds.server;
```

- El prefijo de URL OData V2 será `/v2/<service-path>`.
- El destino SBA en `mta.yaml` apuntará a `~{srv-api/srv-url}/v2/<service-path>/`.

> **Regla**: siempre usar el enfoque moderno (cov2ap) en proyectos nuevos. No mezclar ambos en el mismo proyecto.

### 3 — Configurar `package.json`

Antes de modificar, leer el `package.json` existente para verificar qué configuraciones ya están presentes. Solo añadir las que falten.

Configuración `cds` estándar obligatoria:

```json
"cds": {
  "cov2ap": {
    "plugin": true
  },
  "query": {
    "limit": {
      "default": 1000000,
      "max": 1000000
    }
  },
  "hana": {
    "deploy-format": "hdbtable"
  },
  "requires": {
    "db": {
      "kind": "hana",
      "pool": {
        "acquireTimeoutMillis": 30000
      }
    },
    "auth": {
      "kind": "xsuaa"
    }
  },
  "server": {
    "body_parser": {
      "limit": "50mb"
    }
  }
}
```

Reglas:
- Si `cds.query.limit` no existe o tiene valores distintos, establecer `default` y `max` a `1000000` para evitar paginación por defecto.
- Si `cds.requires.db.pool.acquireTimeoutMillis` no existe, añadirlo con valor `30000`.
- Si `cds.server.body_parser.limit` no existe, añadirlo con valor `"50mb"` para permitir payloads grandes (base64 de ficheros, PDFs, etc.).
- Usar `"auth"` como clave para XSUAA en proyectos nuevos (no `"uaa"`, que corresponde a la clave de la versión legacy del SDK).

### 4 — Declarar servicios externos en `package.json`

**Servicio CAP-a-CAP (OData V2)**:
```json
"serviceAlias": {
  "kind": "odata-v2",
  "model": "srv/external/<modelName>",
  "credentials": {
    "requestTimeout": "300000",
    "destination": "DESTINATION_NAME",
    "path": "/odata/v2/<service-path>"
  }
}
```

Reglas:
- Los ficheros `.csn` y `.edmx` del modelo importado deben existir en `srv/external/`.
- El `path` debe apuntar al endpoint OData V2 del servicio consumido (con `/odata/v2/` si el servicio destino usa cov2ap, con `/v2/` si usa el proxy legacy).
- `requestTimeout` siempre como string `"300000"` (5 minutos).

**Servicio REST genérico (CPI, NEF, microservicios HTTP)**:
```json
"serviceAlias": {
  "kind": "rest",
  "credentials": {
    "requestTimeout": "300000",
    "destination": "DESTINATION_NAME",
    "path": ""
  }
}
```

### 5 — Estructura `mta.yaml`

**Orden obligatorio de `build-parameters.before-all.commands`**:
```yaml
build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm install
        - ./node_modules/.bin/jsdoc -c jsDoc/jsDocConf.json
        - npx cds build --production
```

**Módulo srv** — parámetros estándar:
```yaml
- name: <project>-srv
  type: nodejs
  path: gen/srv
  parameters:
    buildpack: nodejs_buildpack
  build-parameters:
    builder: npm
  provides:
    - name: srv-api
      properties:
        srv-url: ${default-url}
  requires:
    - name: <project>-auth
    - name: <project>-db
    - name: <project>-dest
```

**Módulo db-deployer** — configuración para IT Risk logging (HDI con proveedor externo):
```yaml
- name: <project>-db-deployer
  type: hdb
  path: gen/db
  parameters:
    buildpack: nodejs_buildpack
  requires:
    - name: <project>-db
      properties:
        TARGET_CONTAINER: ~{hdi-service-name}
    - name: <project>-auth
    - name: master-db
      group: SERVICE_REPLACEMENTS
      properties:
        key: master-db-hdi
        service: ~{master-db-hdi}
```

**Módulo app-content** — dos destinos por proyecto (acceso directo + SBA):
```yaml
- name: <project>-app-content
  type: com.sap.application.content
  requires:
    - name: <project>-auth
      parameters:
        service-key:
          name: <project>-auth-key
    - name: srv-api
    - name: <project>-dest
      parameters:
        content-target: true
  parameters:
    content:
      subaccount:
        destinations:
          - Authentication: OAuth2UserTokenExchange
            Name: <PROJECT>_CAP
            TokenServiceInstanceName: <project>-auth
            TokenServiceKeyName: <project>-auth-key
            URL: ~{srv-api/srv-url}
            HTML5.DynamicDestination: true
            HTML5.Timeout: 300000
            WebIDEEnabled: true
            WebIDEUsage: odata_gen

          - Authentication: OAuth2UserTokenExchange
            Name: <PROJECT>_CAP_SBA
            TokenServiceInstanceName: <project>-auth
            TokenServiceKeyName: <project>-auth-key
            URL: ~{srv-api/srv-url}/odata/v2/<service-path>/
            HTML5.DynamicDestination: true
            HTML5.Timeout: 300000
            WebIDEEnabled: true
            WebIDEUsage: odata_gen

        existing_destinations_policy: update
  build-parameters:
    no-source: true
```

> La URL del segundo destino (`<PROJECT>_CAP_SBA`) usa `/odata/v2/` si el proyecto usa cov2ap, o `/v2/` si usa el proxy legacy.

**Recursos estándar**:
```yaml
resources:
  - name: <project>-auth
    type: org.cloudfoundry.existing-service
    parameters:
      service: xsuaa
      service-plan: application
      config:
        xsappname: <project>-xsuaa
        tenant-mode: dedicated

  - name: <project>-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared
    properties:
      hdi-service-name: ${service-name}

  - name: <project>-dest
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-name: <project>-dest
      service-plan: lite

  # IT Risk logging — HDI proveedor externo
  - name: master-db
    type: org.cloudfoundry.existing-service
    parameters:
      service-name: itsriskusersloginscfcap-db
    properties:
      master-db-hdi: ${service-name}
```

### 6 — `xs-security.json` estándar

```json
{
    "xsappname": "<project>-xsuaa",
    "tenant-mode": "dedicated",
    "scopes": [
        {
            "name": "uaa.user",
            "description": "UAA"
        }
    ],
    "attributes": [
        {
            "name": "employeeNumber",
            "description": "employeeNumber",
            "valueType": "s"
        }
    ],
    "role-templates": [
        {
            "name": "Basic",
            "description": "Basic role",
            "scope-references": [
                "uaa.user"
            ],
            "attribute-references": [
                "employeeNumber"
            ]
        }
    ],
    "oauth2-configuration": {
        "redirect-uris": [
            "https://*.eu10.applicationstudio.cloud.sap/**",
            "https://*.cfapps.eu10.hana.ondemand.com/**"
        ]
    }
}
```

### 7 — Namespace CDS y `using`

**Schema** (`db/schema.cds`):
```cds
namespace <projectname>.db;

using {
    managed,
    cuid
} from '@sap/cds/common';
```

**Servicio** (`srv/<serviceName>.cds`):
```cds
using {<projectname>.db as db} from '../db/schema';
```

Regla: el namespace del schema debe coincidir exactamente con el prefijo usado en los nombres técnicos de entidad que se usan como constantes en las libs (ver sección 9).

### 8 — Patrón del fichero de servicio principal (`srv/<serviceName>.js`)

Estructura estándar:

```js
/**
 * @file Implementación del servicio <serviceName>
 * @namespace <serviceName>
 * @author NTTData
 */
const cds = require('@sap/cds');
const ServiceMng = require('./lib/<serviceName>Mng');

module.exports = async function () {

    // Establecer conexiones con base de datos y servicios externos /
    // Establish connections to the database and external services
    const db = await cds.connect.to('db');
    const connExternalService = await cds.connect.to('externalServiceAlias');

    // Instanciar la clase lib pasando todas las conexiones /
    // Instantiate the lib class passing all connections
    const oServiceMng = new ServiceMng(db, connExternalService);

    // Registrar handlers de acciones y funciones /
    // Register action and function handlers
    this.on('myAction', async (req) => {
        let sResult;
        try {
            await oServiceMng.beforeAllRequests(req);
            sResult = await oServiceMng.myAction(req);
        } catch (oError) {
            req.error(oError);
        }
        return sResult;
    });

};
```

Reglas:
- Todas las conexiones `cds.connect.to()` se declaran al inicio del bloque `module.exports`, antes de los handlers.
- La lib se instancia como objeto (`new ServiceMng(...)`) recibiendo las conexiones como parámetros del constructor.
- Cada handler llama a `oServiceMng.beforeAllRequests(req)` antes de la lógica de negocio.
- El handler nunca contiene lógica de negocio; delega siempre en la lib.

### 9 — Patrón de lib (`srv/lib/<serviceName>Mng.js`)

La lib se exporta como una clase con constructor. Para el acceso a entidades en consultas CDS, seguir la recomendación de `cap.instructions.md`: usar `cds.entities` en lugar de strings hardcodeados.

```js
/**
 * @file Librería principal del servicio <serviceName>
 * @namespace <serviceName>Mng
 * @author NTTData
 */
const cds = require('@sap/cds');

module.exports = class ServiceMng {

    /**
     * @description Constructor — recibe las conexiones CDS /
     *   Constructor — receives CDS connections
     * @memberof ServiceMng
     * @method constructor
     * @constructor
     * @param {Object} db - Conexión HANA / HANA connection
     * @param {Object} connExternal - Conexión servicio externo / External service connection
     * @author NTTData
     */
    constructor(db, connExternal) {
        this.db = db;
        this.connExternal = connExternal;
    }

    /**
     * @description Establece el locale de la request a partir del header /
     *   Sets the request locale from the header
     * @memberof ServiceMng
     * @method beforeAllRequests
     * @param {Object} req - Objeto request de CAP / CAP request object
     * @author NTTData
     */
    beforeAllRequests(req) {
        return new Promise((resolve, reject) => {
            let lang;
            if (req.headers.lang) {
                lang = req.headers.lang;
            } else {
                lang = req.headers["accept-language"];
            }
            lang = lang ? lang.substring(0, 2) : lang;
            lang = lang ? lang.toLowerCase() : lang;
            req.locale = lang;
            resolve();
        });
    }

    /**
     * @description Ejemplo de método que accede a entidades via cds.entities /
     *   Example method accessing entities via cds.entities
     * @memberof ServiceMng
     * @method getMyEntityData
     * @param {String} sId - Identificador / Identifier
     * @author NTTData
     * @returns {Object}
     */
    async getMyEntityData(sId) {
        // Acceder a entidades usando cds.entities (recomendado por cap.instructions.md) /
        // Access entities using cds.entities (recommended by cap.instructions.md)
        const { MY_ENTITY } = cds.entities('<projectname>.db');
        return await this.db.run(SELECT.one(MY_ENTITY).where({ ID: sId }));
    }

};
```

Reglas:
- **Nuevo código**: usar `cds.entities('<namespace>.db')` para acceder a las entidades, en línea con `cap.instructions.md`.
- **Código existente (proyectos heredados)**: los proyectos de referencia usan constantes string del tipo `"<namespace>.db.ENTITY_NAME"` como patrón heredado — es aceptable mantenerlo al modificar código existente, pero no debe adoptarse en código nuevo.
- Las constantes globales (usadas en múltiples libs) se extraen a `srv/lib/constants.js`.
- Cuando la lib crece mucho, se divide en: `<serviceName>Mng.js` (lógica principal), `<serviceName>ExtMng.js` (operaciones externas, informes), `constants<Domain>.js` (constantes de dominio).

### 10 — Variables de entorno

```js
const xsenv = require('@sap/xsenv');
xsenv.loadEnv();

// Siempre con fallback / Always with fallback
const myVar = process.env && process.env.MY_VAR ? process.env.MY_VAR : "defaultValue";
const myFlag = process.env && process.env.MY_FLAG && process.env.MY_FLAG === "false" ? false : true;
```

Reglas:
- Cargar `xsenv.loadEnv()` a nivel de módulo, antes de leer `process.env`.
- Siempre proporcionar un valor por defecto seguro con el patrón ternario.
- Las variables de entorno se declaran al inicio del fichero lib, antes de la clase.

### 11 — Proxy de usuario (`metadata_proxyCAP`)

Si el proyecto debe tener soporte de proxy, aplicar la skill **proxy-metadata-cap** (`.github/skills/proxy-metadata-cap/SKILL.md`) que cubre en detalle:
- Declaración del servicio en `package.json`.
- Copia de los ficheros `.csn`/`.edmx` en `srv/external/`.
- Conexión en el fichero de servicio y actualización del constructor.
- Implementación de `getUserId`, `getProxy` y `getRealUserId` en la lib.
- Actualización de `beforeAllRequests` con el parámetro `noProxy`.

### 12 — Ficheros `.http` en `srv/calls/`

Crear un fichero `.http` por cada acción y función declarada en el `.cds`. Convención de nombre: `<actionOrFunctionName>.http`.

Formato estándar para **funciones** (GET):
```http
GET http://localhost:4004/odata/v2/<service-path>/<FunctionName>
Accept-Language: es
Content-Type: application/json
```

Formato estándar para **acciones** (POST):
```http
POST http://localhost:4004/odata/v2/<service-path>/<ActionName>
Accept-Language: es
Content-Type: application/json

{
  "data": {}
}
```

> Para proyectos legacy (proxy), sustituir `/odata/v2/` por `/v2/`.

### 13 — `.vscode/launch.json`

Si la carpeta `.vscode/launch.json` no existe o no contiene la configuración `cds watch`, crearla o añadir la configuración:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "command": "cds watch --with-mocks --in-memory? --profile hybrid",
      "name": "cds watch",
      "request": "launch",
      "type": "node-terminal",
      "skipFiles": [
        "<node_internals>/**"
      ]
    }
  ]
}
```

Reglas:
- Verificar si `.vscode/launch.json` ya existe antes de crearlo.
- Si existe y ya contiene una entrada con `"command": "cds watch..."`, no modificarla.
- Si existe pero no tiene ninguna configuración `cds watch`, añadir el bloque dentro del array `configurations`.
- La opción `--in-memory?` (con `?`) hace que el flag sea opcional: si SQLite no está disponible, CAP lo ignora en lugar de fallar.
- `--profile hybrid` activa el perfil que combina servicios locales con destinos BTP reales (útil para probar contra HANA o servicios externos sin desplegar).

---

## Criterios de aceptación

### Configuración OData V2
- [ ] `@cap-js-community/odata-v2-adapter` en `dependencies` de `package.json`.
- [ ] `cov2ap.plugin: true` declarado en la sección `cds` de `package.json`.
- [ ] No existe `srv/server.js` (o si existe, es el legacy y está documentado).
- [ ] El segundo destino en `mta.yaml` apunta a `/odata/v2/<service-path>/`.

### `package.json`
- [ ] `query.limit.default` y `query.limit.max` son `1000000` (añadir si no están o son distintos).
- [ ] `db.pool.acquireTimeoutMillis` es `30000` (añadir si no está).
- [ ] `server.body_parser.limit` es `"50mb"` (añadir si no está).
- [ ] Los servicios externos usan `kind: "odata-v2"` (CAP-a-CAP) o `kind: "rest"` (HTTP).
- [ ] `requestTimeout` es `"300000"` en todos los servicios externos.

### `mta.yaml`
- [ ] Orden de build commands: `npm install` → `jsdoc` → `cds build --production`.
- [ ] Dos destinos en `app-content`: directo (`<PROJECT>_CAP`) y SBA (`<PROJECT>_CAP_SBA`).
- [ ] Recursos: auth (existing-service), db (hdi-container), dest (managed-service), master-db (existing-service).
- [ ] `TARGET_CONTAINER: ~{hdi-service-name}` en el módulo `db-deployer`.

### `xs-security.json`
- [ ] Atributo `employeeNumber` declarado.
- [ ] Scope `uaa.user` declarado.
- [ ] Role template `Basic` referencia el scope y el atributo.
- [ ] `redirect-uris` incluye los patrones `eu10.applicationstudio` y `eu10.hana.ondemand`.

### Lib
- [ ] La lib es una clase exportada con `module.exports = class ... { }`.
- [ ] El constructor recibe todas las conexiones CDS como parámetros.
- [ ] Existe el método `beforeAllRequests(req)` que establece `req.locale`.
- [ ] En código nuevo las entidades se acceden con `cds.entities('<namespace>.db')` (no strings hardcodeados).

### Ficheros `.http`
- [ ] Existe al menos un `.http` por cada acción y función del servicio.
- [ ] Los ficheros están en `srv/calls/`.
- [ ] Las URLs usan `/odata/v2/` (cov2ap) o `/v2/` (legacy) según corresponda.

### `.vscode/launch.json`
- [ ] Existe `.vscode/launch.json` con la configuración `cds watch`.
- [ ] El comando incluye `--with-mocks --in-memory? --profile hybrid`.
- [ ] No se ha sobreescrito una configuración preexistente.

### Proxy (`metadata_proxyCAP`) — solo si aplica
- [ ] Skill `proxy-metadata-cap` aplicada.
- [ ] `metadata_proxyCAP` declarado en `cds.requires` con `kind: "odata-v2"`.
- [ ] Ficheros `.csn`/`.edmx` en `srv/external/`.
- [ ] `getUserId`, `getProxy` y `getRealUserId` implementados en la lib.
- [ ] `beforeAllRequests` actualizado con el parámetro `noProxy`.

---

## Checklist rápido

- [ ] Artefactos existentes leídos antes de modificar
- [ ] OData V2: cov2ap activado (no legacy salvo que ya exista)
- [ ] `package.json`: límites, HANA pool, body_parser y servicios externos correctos (solo añadir los que faltan)
- [ ] `mta.yaml`: orden de builds, dos destinos, recursos estándar
- [ ] Lib exportada como clase con constructor y `beforeAllRequests`
- [ ] Ficheros `.http` en `srv/calls/` para pruebas locales
- [ ] Namespace CDS coherente entre schema y `using` del servicio
- [ ] `.vscode/launch.json` con `cds watch --with-mocks --in-memory? --profile hybrid`
- [ ] Proxy aplicado (skill proxy-metadata-cap) si el proyecto lo requiere
