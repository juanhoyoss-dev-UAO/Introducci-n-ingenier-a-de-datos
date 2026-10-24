# Reglas permanentes del repositorio

## Alcance y forma de trabajo

- Trabajar por microbloques aprobados y detenerse al completar cada uno. No iniciar fases siguientes automáticamente.
- Aplicar el mínimo cambio necesario para cumplir la tarea autorizada.
- No alterar contratos, arquitectura, esquema de base de datos ni dependencias estructurales sin aprobación explícita.
- No modificar archivos fuera del alcance autorizado.

## Antes de editar

- Leer primero este archivo, `docs/ESTADO.md`, los archivos implicados y sus dependencias directas.
- No releer todo el repositorio sin una justificación concreta.
- Ejecutar `git status` antes de editar y preservar cualquier trabajo ajeno o cambio no confirmado.
- Ante conflictos, ambigüedades de arquitectura o bloqueos importantes, detenerse e informar; no inventar soluciones.

## Verificación y entrega

- Ejecutar pruebas proporcionales al cambio y reportar únicamente resultados reales.
- No crear pruebas vacías o falsas para obtener resultados exitosos.
- Después de cada tarea, entregar un informe estructurado por archivo que incluya decisiones, verificaciones y pendientes.
- Entregar cada resumen de ejecución como un archivo PDF descargable, además de cualquier mensaje breve de acompañamiento en el chat.
- No realizar `commit`, `push`, despliegues ni operaciones Git destructivas sin autorización.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
