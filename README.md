
# Redes de Ayuda

Prototipo académico para la coordinación de centros de acopio en Cali. El repositorio se encuentra en el Bloque A: contiene la base de Next.js y la documentación inicial, pero todavía no implementa autenticación, persistencia, importaciones, dashboard ni simulaciones.

## Requisitos

- Node.js 20.9 o superior. La configuración inicial fue verificada con Node.js 24.
- npm 11 o una versión compatible con la instalación de Node.js.
- Git.

No se requieren credenciales ni variables de entorno para el Bloque A. Los archivos `.env*` están ignorados para evitar versionar secretos; cuando una fase posterior necesite configuración se deberá añadir un `.env.example` sin valores reales.

## Instalación

```bash
git clone https://github.com/juanhoyoss-dev-UAO/Introducci-n-ingenier-a-de-datos.git
cd Introducci-n-ingenier-a-de-datos
npm install
```

`npm install` usa `package-lock.json` para resolver las mismas versiones verificadas. En automatización o instalaciones completamente reproducibles puede utilizarse `npm ci`.

## Ejecución

```bash
npm run dev
```

Abrir `http://localhost:3000`. La página debe mostrar “Redes de Ayuda” y “Prototipo académico de coordinación de centros de acopio”.

Para una ejecución de producción local:

```bash
npm run build
npm run start
```

## Verificaciones

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

## Estructura general

- `src/app`: rutas y páginas de Next.js.
- `src/features`: módulos funcionales futuros.
- `src/server`: servicios backend y acceso futuro a datos.
- `src/contracts`: esquemas y tipos compartidos futuros.
- `src/domain`: reglas de negocio puras futuras.
- `src/components`: componentes visuales reutilizables.
- `src/lib`: utilidades compartidas.
- `data`: plantillas y datos de demostración futuros.
- `supabase`: migraciones futuras, no creadas todavía.
- `docs`: arquitectura, datos, API, decisiones, estado y bitácora.
- `tests`: pruebas automatizadas futuras.

Consulte `docs/ARQUITECTURA.md` para las responsabilidades completas y `docs/ESTADO.md` antes de iniciar una tarea.

## Flujo básico de Git para colaboradores

1. Actualizar la rama local y comprobar `git status`.
2. Crear una rama corta para el microbloque autorizado.
3. Realizar cambios mínimos y ejecutar las verificaciones proporcionales.
4. Revisar `git diff` y confirmar que no contiene secretos ni trabajo ajeno.
5. Solicitar revisión antes de integrar. No avanzar al siguiente bloque sin aprobación.

No se debe hacer `push`, desplegar ni modificar la arquitectura o el contrato de datos sin la coordinación del equipo.
