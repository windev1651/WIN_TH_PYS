# TH_PYS · Fundacion tecnica

Base tecnica para la aplicacion Slack de Paz y Salvo de Talento Humano.

## Decisiones vigentes

- Bolt for JavaScript v5
- TypeScript
- Node.js 20+
- Socket Mode
- Hosting objetivo: VM Linux en validacion
- Docker Compose como opcion recomendada de ejecucion en VM
- Listas Slack con prefijo `TH_PYS_`

## Requisitos

- Node.js 20 o superior
- npm
- Una Slack App configurada con Socket Mode
- Bot token `xoxb-...`
- App-level token `xapp-...` con scope `connections:write`

## Primer arranque local

1. Copiar `.env.example` a `.env`.
2. Completar `SLACK_BOT_TOKEN` y `SLACK_APP_TOKEN`.
3. Instalar dependencias:

   `npm install`

4. Validar tipos:

   `npm run typecheck`

5. Ejecutar:

   `npm run dev`

6. Abrir el Home de la app en Slack. Debe aparecer el mensaje `Fundacion tecnica activa`.

## Manifest

`slack-manifest.yaml` contiene una configuracion inicial. Los scopes se revisaran y ajustaran conforme se implementen las historias del backlog.

## Docker / VM

1. Crear `.env` con secretos reales en la VM.
2. Ejecutar `docker compose up -d --build`.
3. Consultar logs con `docker compose logs -f th-pys`.
4. El contenedor usa `restart: unless-stopped`.

## Estructura

- `src/app.ts`: bootstrap Bolt y ciclo de vida.
- `src/config/env.ts`: validacion de variables de entorno.
- `src/listeners/`: listeners de Slack.
- `src/utils/logger.ts`: logging estructurado y correlation ID.
- `slack-manifest.yaml`: configuracion inicial de Slack App.

## Criterios EP01 cubiertos por esta base

- HU01.01: proyecto Bolt + TypeScript estructurado y compilable.
- HU01.02: Socket Mode configurado en codigo y manifest; conexion real requiere tokens.
- HU01.03: variables y secretos separados del codigo con `.env.example`.
- HU01.04: Dockerfile/Compose preparados para validacion en VM.
- HU01.05: logging estructurado y correlation ID iniciales.
