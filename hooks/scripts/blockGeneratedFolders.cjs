#!/usr/bin/env node
/**
 * Hook PreToolUse: bloquea la lectura/exploración de carpetas generadas o de
 * artefactos (gen/, node_modules/, mta_archives/, dist/, db/data/) en cualquier
 * proyecto del workspace, de forma determinista (no depende de que el agente
 * recuerde la regla documentada en los agentes de descripción) /
 * PreToolUse hook: deterministically blocks reading/exploring generated or
 * vendor folders (gen/, node_modules/, mta_archives/, dist/, db/data/) in any
 * project of the workspace, without relying on the agent remembering the rule
 * documented in the description agents.
 *
 * Si el payload no tiene el formato esperado, o algo falla al parsear, el hook
 * no toma ninguna decisión (falla abierto) para no romper el flujo normal /
 * If the payload does not have the expected shape, or parsing fails, the hook
 * makes no decision (fails open) so normal flow is never broken.
 */
const fs = require("node:fs");

// Segmentos de ruta que nunca deben explorarse, con la decisión a aplicar en
// cada caso. "node_modules/" usa "ask" porque sí tiene casos de uso legítimos
// (depurar una librería, un problema de instalación); el resto usa "deny"
// porque son artefactos regenerables/datos semilla sin ningún caso de uso real
// de lectura / Path segments that must never be explored, with the decision
// to apply in each case. "node_modules/" uses "ask" because it does have
// legitimate use cases (debugging a library, an installation issue); the rest
// use "deny" because they are regenerable artifacts/seed data with no real
// read use case.
const FORBIDDEN_SEGMENTS = [
    { segment: "node_modules/", decision: "ask" },
    { segment: "mta_archives/", decision: "deny" },
    { segment: "gen/", decision: "deny" },
    { segment: "dist/", decision: "deny" },
    { segment: "db/data/", decision: "deny" },
];

// Longitud máxima de una ruta plausible; evita falsos positivos en blobs de
// una sola línea pero muy largos (p. ej. JSON minificado) / Maximum plausible
// path length; avoids false positives on single-line but very long blobs
// (e.g. minified JSON).
const MAX_PATH_LENGTH = 500;

/**
 * Recorre recursivamente el payload y recoge solo los valores de texto que
 * podrían ser una ruta real: una sola línea (sin `\n`) y de longitud
 * razonable. Esto excluye a propósito bloques de texto multilínea (prompts
 * de subagentes, contenido de ficheros a escribir, documentación), que son
 * precisamente donde aparecen estos nombres de carpeta como simple texto, no
 * como una ruta que se vaya a leer / Recursively walks the payload and
 * collects only text values that could plausibly be a real path: single-line
 * (no `\n`) and of reasonable length. This deliberately excludes multi-line
 * text blocks (subagent prompts, file content to write, documentation),
 * which is exactly where these folder names appear as plain text, not as a
 * path that is actually going to be read.
 */
function collectPathLikeStrings(value, acc) {
    if (typeof value === "string") {
        if (!value.includes("\n") && value.length <= MAX_PATH_LENGTH) {
            acc.push(value);
        }
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectPathLikeStrings(item, acc);
        return;
    }
    if (value && typeof value === "object") {
        for (const key of Object.keys(value)) collectPathLikeStrings(value[key], acc);
    }
}

function main() {
    let raw = "";
    try {
        raw = fs.readFileSync(0, "utf8");
    } catch (err) {
        process.stdout.write("{}");
        return;
    }

    let event;
    try {
        event = JSON.parse(raw);
    } catch (err) {
        process.stdout.write("{}");
        return;
    }

    // toolArgs/tool_args es de tipo "unknown", sin campo de ruta garantizado
    // entre tools (view/read/grep/glob/bash...), así que se recorre toda la
    // estructura buscando candidatos a ruta en vez de fiarse de un nombre de
    // campo concreto / toolArgs/tool_args is typed as "unknown" with no
    // guaranteed path field across tools (view/read/grep/glob/bash...), so
    // the whole structure is walked looking for path candidates instead of
    // relying on a specific field name.
    const payload = event && (event.toolArgs !== undefined ? event.toolArgs : event.tool_args !== undefined ? event.tool_args : event);
    const candidates = [];
    collectPathLikeStrings(payload || {}, candidates);

    let match;
    for (const candidate of candidates) {
        match = FORBIDDEN_SEGMENTS.find(({ segment }) => candidate.includes(segment));
        if (match) break;
    }

    if (match) {
        process.stdout.write(
            JSON.stringify({
                permissionDecision: match.decision,
                permissionDecisionReason:
                    `Carpeta excluida del análisis (${match.segment}): artefacto generado/vendor, no se explora ni se lee salvo necesidad real (p. ej. depurar una dependencia). ` +
                    `Ver .github/agents/Agente_descripcion_tecnica.agent.md. / ` +
                    `Excluded folder from analysis (${match.segment}): generated/vendor artifact, not explored or read unless there is a real need (e.g. debugging a dependency). ` +
                    `See .github/agents/Agente_descripcion_tecnica.agent.md.`,
            })
        );
    } else {
        process.stdout.write("{}");
    }
}

main();
