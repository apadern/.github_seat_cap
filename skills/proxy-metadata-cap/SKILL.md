# Integración de metadata_proxyCAP y getUserId con soporte de proxy

## Propósito

Cuando un proyecto CAP necesita soporte de proxy de usuario (NIS lookup mediante el servicio `metadata_proxyCAP`), esta skill describe todos los cambios necesarios para habilitarlo: configuración del servicio externo en `package.json`, importación del modelo `.csn`/`.edmx`, conexión en el fichero de servicio, e implementación de los métodos `getUserId`, `getProxy` y `getRealUserId` en la lib.

---

## Triggers y cuándo usar la skill

- "añadir proxy al proyecto"
- "configurar metadata_proxyCAP"
- "el proyecto debe tener proxy"
- "getUserId con proxy"
- "getNis con soporte de proxy"
- "integrar proxy CAP"
- "buscar NIS por proxy"
- Cualquier mención a `PROXY_CAP`, `connProxyCAP`, `getProxy` o `noProxy`

---

## Procedimiento

### 1 — Añadir dependencia de modelo en `srv/external/`

Los ficheros del modelo del servicio proxy deben existir en `srv/external/`. Si no existen, copiarlos desde otro proyecto del workspace que los tenga (ej: `communicationtoolcfcap/srv/external/`):

```
srv/external/metadata_proxyCAP.csn
srv/external/metadata_proxyCAP.edmx
```

### 2 — Declarar el servicio externo en `package.json`

En la sección `cds.requires`, añadir:

```json
"metadata_proxyCAP": {
  "kind": "odata-v2",
  "model": "srv/external/metadata_proxyCAP",
  "credentials": {
    "requestTimeout": "300000",
    "destination": "PROXY_CAP",
    "path": "/odata/v2/proxy-service"
  }
}
```

> El `path` usa `/odata/v2/` si el servicio proxy destino usa cov2ap, o `/v2/` si usa el proxy legacy.

### 3 — Conectar en el fichero de servicio principal

En `srv/<serviceName>.js`, añadir la conexión y pasarla al constructor de la lib:

```js
const connProxyCAP = await cds.connect.to("metadata_proxyCAP");

const oServiceMng = new ServiceMng(db, connProxyCAP /*, ...otras conexiones */);
```

### 4 — Actualizar el constructor de la lib

En `srv/lib/<serviceName>Mng.js`, recibir y almacenar `connProxyCAP`:

```js
constructor(db, connProxyCAP /*, ...otras conexiones */) {
    this.db = db;
    this.connProxyCAP = connProxyCAP;
}
```

### 5 — Actualizar `beforeAllRequests` para pasar `noProxy`

El método `beforeAllRequests` acepta un segundo parámetro `noProxy`. Cuando se llama con `noProxy = true`, se omite la consulta al proxy y se obtiene el NIS directamente del token:

```js
beforeAllRequests(req, noProxy) {
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

        this.getUserId(req, noProxy).then((userId) => {
            req.user.id = userId;
            resolve();
        }).catch((oError) => {
            reject(oError);
        });
    });
}
```

> En los handlers que no requieren proxy (ej: `registerITSLOG`), invocar `beforeAllRequests(req, true)`.
> En los handlers que sí deben resolverlo, invocar `beforeAllRequests(req)` o `beforeAllRequests(req, false)`.

### 6 — Implementar `getUserId` con soporte de proxy

```js
/**
 * @description Recupera el NIS del usuario. Si hay proxy activo lo obtiene de él;
 *   si no, lo extrae del token JWT (atributo IAS employeeNumber) /
 *   Gets the user NIS. If a proxy is active it retrieves it from there;
 *   otherwise it extracts it from the JWT token (IAS employeeNumber attribute)
 * @memberof ServiceMng
 * @method getUserId
 * @param {Object} req - Objeto request de CAP / CAP request object
 * @param {Boolean} noProxy - Omitir consulta de proxy / Skip proxy lookup
 * @author NTTData
 * @returns {Promise<String>}
 */
getUserId(req, noProxy) {
    return new Promise((resolve, reject) => {
        const aPromises = [];
        let userId = req.user.id;

        if (!noProxy) {
            // Si hay proxy habilitado se consulta el NIS del proxy /
            // If proxy is enabled, query the proxy NIS
            aPromises.push(this.getProxy());
        }

        Promise.all(aPromises).then((aData) => {
            if (aData && aData[0] && aData[0].NIS) {
                // NIS obtenido del proxy / NIS obtained from proxy
                userId = aData[0].NIS;
            } else if (req.headers.authorization) {
                // Obtener NIS del token JWT (atributo IAS employeeNumber) /
                // Get NIS from JWT token (IAS employeeNumber attribute)
                const jwt = jwtDecode(req.headers.authorization);
                if (jwt && jwt[xsAttrField]
                    && jwt[xsAttrField].employeeNumber
                    && Array.isArray(jwt[xsAttrField].employeeNumber)
                    && jwt[xsAttrField].employeeNumber.length > 0) {
                    userId = jwt[xsAttrField].employeeNumber[0];
                }
            }
            resolve(userId);
        }).catch((oError) => {
            reject(oError);
        });
    });
}
```

Constantes necesarias que deben declararse antes de la clase:

```js
// Campo de atributos de usuario en el token IAS /
// User attributes field in the IAS token
const xsAttrField = "xs.user.attributes";
```

Dependencia necesaria en la lib:

```js
const jwtDecode = require('jwt-decode').jwtDecode;
```

### 7 — Implementar `getProxy`

```js
/**
 * @description Llama al servicio metadata_proxyCAP para buscar si existe
 *   un proxy guardado para el usuario logeado /
 *   Calls the metadata_proxyCAP service to check if a proxy exists
 *   for the logged-in user
 * @memberof ServiceMng
 * @method getProxy
 * @author NTTData
 * @returns {Promise<Object>}
 */
getProxy() {
    return new Promise((resolve, reject) => {
        this.connProxyCAP.get("/getProxy?type='NIS'").then((oData) => {
            oData = oData.getProxy ? oData.getProxy : {};
            resolve(oData);
        }).catch((oError) => {
            // Si falla el proxy se resuelve con objeto vacío para no bloquear /
            // If proxy fails, resolve with empty object to avoid blocking
            resolve({});
        });
    });
}
```

### 8 — Implementar `getRealUserId` (NIS sin proxy)

```js
/**
 * @description Recupera el NIS real del usuario directamente desde el token JWT,
 *   sin pasar por el proxy /
 *   Gets the real user NIS directly from the JWT token,
 *   without going through the proxy
 * @memberof ServiceMng
 * @method getRealUserId
 * @param {Object} req - Objeto request de CAP / CAP request object
 * @author NTTData
 * @returns {String}
 */
getRealUserId(req) {
    let userId = req?.req?.user?.id;

    if (req.headers.authorization) {
        const jwt = jwtDecode(req.headers.authorization);
        if (jwt && jwt[xsAttrField]
            && jwt[xsAttrField].employeeNumber
            && Array.isArray(jwt[xsAttrField].employeeNumber)
            && jwt[xsAttrField].employeeNumber.length > 0) {
            userId = jwt[xsAttrField].employeeNumber[0];
        }
    }
    return userId;
}
```

### 9 — Añadir `jwt-decode` a `package.json` si no está

```json
"jwt-decode": "^4.0.0"
```

> Nota: a partir de la versión 4 la importación es `require('jwt-decode').jwtDecode` (named export), no `require('jwt-decode')` directamente.

---

## Clasificación del origen del NIS

| Fuente | Condición | Método usado |
|---|---|---|
| Proxy (NIS real) | `noProxy = false` y hay proxy guardado | `getProxy()` → `aData[0].NIS` |
| Token IAS (`employeeNumber`) | Sin proxy o `noProxy = true` | `jwtDecode` → `jwt[xsAttrField].employeeNumber[0]` |
| `req.user.id` (fallback) | Sin token ni proxy | Valor por defecto de CAP |

---

## Notas sobre falsos positivos / casos especiales

- Si `getProxy()` lanza error (destino no configurado, timeout) se resuelve con `{}` para no bloquear el flujo; el NIS se resolverá por el token.
- En entorno local (`cds watch`) el header `Authorization` puede no estar disponible; `userId` quedará como `req.user.id` (usuario mock).
- La constante `xsAttrField = "xs.user.attributes"` debe estar declarada a nivel de módulo en la lib, antes de la clase.
