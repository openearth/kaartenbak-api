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
| `/api/factsheet` | GET | Returns factsheet details. Query params: `id` (required), `format` (`html` or `json`). See [details](#get-apifactsheet). |
| `/api/layer` | GET | Returns layer metadata. Query params: `id` (layer id), `format` (`xml` or `json`). See [details](#get-apilayer). |
| `/api/viewer-layer` | GET | Returns viewer-layer metadata (external or generated). Query params: `id` (viewer layer id), `format` (`xml` or `json`). See [details](#get-apiviewer-layer). |
| `/api/search` | GET | Returns layers of a viewer matching a search query (JSON). Query params: `viewer` (viewer name), `query` (search string). See [details](#get-apisearch). |
| `/api/record-register` | GET | Returns the GeoNetwork record URL for a record. Query params: `record` (record id), `viewer` (viewer name). See [details](#get-apirecord-register). |
| `/api/feedback` | POST | Submits feedback: validates viewer/menu/layer, finds feedback contacts, sends email via Mailjet. Body (JSON): `viewer`, `menuOrLayerId`, `name`, `email`, `feedback`, `shareUrl`. See [details](#post-apifeedback). |
| `/api/sync-layer-background` | POST | Dato CMS webhook for **Layer**. Syncs layer metadata and thumbnails to GeoNetwork. See [Layer sync](#layer-sync-sync-layer-background) below. |
| `/api/sync-viewer-layer-background` | POST | Dato CMS webhook for **Viewer layer** and **Menu (viewer)**. Syncs viewer-layer metadata and thumbnails to GeoNetwork. See [Viewer layer sync](#viewer-layer-sync-sync-viewer-layer-background) below. |

Webhook endpoints (`sync-layer-background`, `sync-viewer-layer-background`) require header `x-api-key` equal to `SYNC_LAYER_API_TOKEN`.

### Endpoint details

All error responses share the same shape: `{ "error": "<message>" }`, with the status codes shown below.

#### `GET /api/factsheet`

Request:

```
GET /api/factsheet?id=123456&format=json
```

- `id` (required) — DatoCMS factsheet item id.
- `format` (required) — `html` or `json`.

Responses:

- `200` — `format=json`: the factsheet record as JSON (raw DatoCMS fields, e.g. `title`, `samenvatting`, `themas`, …). `format=html`: a rendered HTML page.
- `404` — missing `id`/`format` query parameter.
- `400` — `format` is not `html`/`json`.

#### `GET /api/layer`

Request:

```
GET /api/layer?id=123456&format=xml
```

- `id` (required) — DatoCMS layer item id.
- `format` (required) — `xml` or `json`.

Responses:

- `200` — the generated ISO 19139/INSPIRE (or factsheet-derived) metadata XML for the layer, or its JSON-converted (`xml-js` compact) equivalent when `format=json`.
- `404` — missing `id`/`format` query parameter.
- `400` — `format` is not `xml`/`json`.

#### `GET /api/viewer-layer`

Request:

```
GET /api/viewer-layer?id=789012&format=xml
```

- `id` (required) — DatoCMS viewer-layer item id.
- `format` (required) — `xml` or `json`.

Responses:

- `200` — the generated (or external) metadata XML for the viewer-layer, or its JSON equivalent when `format=json`.
- `404` — missing `id`/`format` query parameter, or no metadata (`factsheets`/`inspireMetadata`/external URL) exists for this viewer-layer (`{ "error": "No metadata found for this layer" }`).
- `400` — `format` is not `xml`/`json`.

#### `GET /api/search`

Request:

```
GET /api/search?viewer=Kaartenbak&query=bodem
```

- `viewer` (required) — the viewer's `name` in DatoCMS.
- `query` (required) — search term, matched case-insensitively against layer `name`, `description` and `indexableWfsProperties` keywords.

Response body (`200`):

```json
[
  { "id": "123456", "name": "Bodemkaart", "description": "…" }
]
```

- `404` — missing `viewer`/`query` query parameter, or viewer not found (`{ "error": "viewer not found" }`).

#### `GET /api/record-register`

Request:

```
GET /api/record-register?record=abc-123&viewer=Kaartenbak
```

- `record` (required) — the GeoNetwork record id/uuid.
- `viewer` (required) — the viewer's `name` in DatoCMS (used to resolve the correct GeoNetwork instance).

Response body (`200`):

```json
{ "url": "https://<geonetwork-base-url>/geonetwork/srv/dut/catalog.search#/metadata/abc-123" }
```

- `404` — missing `record`/`viewer` query parameter, viewer not found, no GeoNetwork instance registered for the record, or the record doesn't exist in GeoNetwork.

#### `POST /api/feedback`

Request body (JSON):

```json
{
  "viewer": "Kaartenbak",
  "menuOrLayerId": "123456",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "feedback": "This layer is missing data for 2024.",
  "shareUrl": "https://viewer.example.com/share/abc"
}
```

- `viewer` (required) — the viewer's `name` in DatoCMS.
- `menuOrLayerId` (required) — id of the menu/folder/layer the feedback is about.
- `name` (required) — sender's display name.
- `email` (required) — must pass `email-validator`.
- `feedback` (required) — the feedback text.
- `shareUrl` (optional) — link included in the notification email.

Responses:

- `200` — feedback emailed (via Mailjet) to the resolved feedback contacts (no body).
- `400` — a required field is missing, or `email` is invalid.
- `404` — viewer, menu/layer, or feedback contacts not found.

#### Webhook endpoints (`sync-layer-background`, `sync-viewer-layer-background`)

Both require the header `x-api-key: <SYNC_LAYER_API_TOKEN>` and a DatoCMS webhook-shaped JSON body, e.g.:

```json
{
  "entity": { "id": "123456", "type": "item" },
  "event_type": "publish",
  "related_entities": [
    {
      "id": "789",
      "type": "item_type",
      "attributes": { "api_key": "viewer_layer" }
    }
  ]
}
```

- `event_type` — one of `create`, `update`, `publish` (drives whether GeoNetwork gets a `PUT` create or an `OVERWRITE` publish).
- `related_entities[].attributes.api_key` (`sync-viewer-layer-background` only) — used to tell a `viewer_layer` webhook apart from a `menu` webhook.

Responses:

- `202` — always returned once the payload is accepted; sync happens asynchronously and failures are emailed to the viewer's `errorNotificationContacts`, not returned as an HTTP error.
- `401` — missing/incorrect `x-api-key` header.

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
