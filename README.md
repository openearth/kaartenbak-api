# Kaartenbak API

API layer on top of [Kaartenbak CMS](https://ihm-kaarten-bak.admin.datocms.com/), using [Netlify functions](https://docs.netlify.com/functions/overview/).

## Run locally 

- **Prerequisites:** [Node.js](https://nodejs.org/) (18 or later recommended).

```bash
git clone <repository-url>
cd kaartenbak-api
npm install
```

Copy environment variables and fill in your values:

```bash
cp .env.example .env
```

Required for the API and scripts (see `.env.example`):

- `DATO_API_TOKEN` — Dato CMS API token (used by default for GraphQL).
- `SYNC_LAYER_API_TOKEN` — Secret for webhook endpoints `sync-layer-background` and `sync-viewer-layer-background`.
- For sync scripts: `DATO_API_KEY_NL2120`, `DATO_API_KEY_OPENEARTH_RWS_VIEWER` (or whichever instances you use).
- For GeoNetwork sync and record-register: `GEONETWORK_API_USERNAME`, `GEONETWORK_API_PASSWORD` (if used by your Dato/GeoNetwork setup).
- For feedback and error emails: `MAILJET_API_TOKEN`, `MAILJET_API_SECRET`, `MAILJET_FROM_EMAIL`.

Start the Netlify dev server (API and redirects):

```bash
netlify dev
```

 The API is then available at **http://localhost:8080**. For example:

- http://localhost:8080/
- http://localhost:8080/api/factsheet?id=…&format=html
- http://localhost:8080/api/search?viewer=…&query=…

Scripts do not require the dev server. Run them from the project root:

```bash
npm run sync-external-metadata
npm run report
```

## API Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/` | GET | Returns an overview of all factsheets in HTML. |
| `/api/factsheet` | GET | Returns factsheet details. Query params: `id` (required), `format` (`html` or `json`). |
| `/api/layer` | GET | Returns layer metadata. Query params: `id` (layer id), `format` (`xml` or `json`). |
| `/api/viewer-layer` | GET | Returns viewer-layer metadata (external or generated). Query params: `id` (viewer layer id), `format` (`xml` or `json`). |
| `/api/search` | GET | Returns layers of a viewer matching a search query (JSON). Query params: `viewer` (viewer name), `query` (search string). |
| `/api/record-register` | GET | Returns the GeoNetwork record URL for a record. Query params: `record` (record id), `viewer` (viewer name). |
| `/api/feedback` | POST | Submits feedback: validates viewer/menu/layer, finds feedback contacts, sends email via Mailjet. Body (JSON): `viewer`, `menuOrLayerId`, `name`, `email`, `feedback`, `shareUrl`. |
| `/api/sync-layer-background` | POST | Dato CMS webhook for **Layer**. Syncs layer metadata and thumbnails to GeoNetwork. See [Layer sync](#layer-sync-sync-layer-background) below. |
| `/api/sync-viewer-layer-background` | POST | Dato CMS webhook for **Viewer layer** and **Menu (viewer)**. Syncs viewer-layer metadata and thumbnails to GeoNetwork. See [Viewer layer sync](#viewer-layer-sync-sync-viewer-layer-background) below. |

Webhook endpoints (`sync-layer-background`, `sync-viewer-layer-background`) require header `x-api-key` equal to `SYNC_LAYER_API_TOKEN`.

## How synchronising DatoCMS Kaartenbak to GeoNetwork works

![Synchronising layer](/docs/sync-layer.svg)

### Layer sync (`sync-layer-background`)

Triggered when a **Layer** is created or published in Dato CMS. The handler receives the webhook payload (e.g. `entity.id` = layer id, `event_type` = `create` or `publish`). It loads the menu tree, finds every GeoNetwork instance that uses that layer, fetches the layer XML (from factsheet/INSPIRE metadata), and creates or overwrites the record (and thumbnails) in each GeoNetwork. On failure, it sends error emails to the viewer’s `errorNotificationContacts`.

### Viewer layer sync (`sync-viewer-layer-background`)

Triggered when a **Viewer layer** or a **Menu (viewer)** is created, updated, or published in Dato CMS. It uses the **preview** environment and inspects `related_entities` to get the item type.

- **Viewer layer** (`viewer_layer`): finds GeoNetwork instances for that viewer layer, fetches the viewer-layer XML (external metadata or generated), then creates or updates the record and thumbnails in each GeoNetwork (create/update/publish).
- **Menu (viewer)** (`menu`): finds all viewer layers under that viewer and runs the same viewer-layer sync for each.

On failure, it sends error emails to the viewer’s `errorNotificationContacts`. The endpoint always returns `202`; errors are logged and emailed, not returned as 5xx.

## External metadata synchronization

External metadata (e.g. from other GeoNetwork instances) is synchronized by the script in `src/scripts/sync-external-metadata.js`, scheduled via GitHub Actions.

### How it works

1. Connects to each configured Dato CMS instance (see `instances` in the script).
2. Retrieves the menu structure with viewer layers and external metadata URLs.
3. For each entry with an external metadata URL:
   - Fetches the metadata XML from the source URL.
   - Transforms it (adds thumbnails, links, replaces IDs).
   - Uploads the result to the destination GeoNetwork instance.

If one item fails, the script logs the error and continues with the rest.

### Running the script

```bash
npm run sync-external-metadata
```

Or directly:

```bash
node src/scripts/sync-external-metadata.js
```

Requires a `.env` with the relevant `DATO_API_KEY_*` (and optionally Mailjet secrets for error notifications). Set `SKIP_GEONETWORK_PUBLISH = true` in the script to run without publishing to GeoNetwork (e.g. for testing).

### Automated scheduling

GitHub Action `.github/workflows/sync-external-metadata.yml`:

- Runs daily at midnight (cron: `0 0 * * *`).
- Can be triggered manually via `workflow_dispatch`.
- Uses Node.js 20 and requires the Dato CMS API keys as GitHub secrets.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run sync-external-metadata` | Runs `src/scripts/sync-external-metadata.js`: syncs external metadata from configured Dato instances to GeoNetwork (see above). |
| `npm run report` | Runs `src/scripts/report-dead-layer-links.js`: builds the menu tree, finds dead WMS/layer links, filters them, and emails a report to `deadLinksReportContacts` per viewer. |

## GitHub Actions

| Workflow | Description |
|----------|-------------|
| `sync-external-metadata.yml` | Runs the external metadata sync script on a schedule and/or via manual trigger. |
| `dead-layer-links-reporter.yml` | Dead layer links reporter; currently commented out (TODO). When enabled, runs `npm run report` on a schedule. |
