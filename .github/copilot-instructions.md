# Kaartenbak API – Copilot Instructions

## Architecture Overview

This is a **Netlify Functions** API that serves as an intermediary layer between:
- **DatoCMS** (CMS / source of truth for layers, viewer-layers, menus, factsheets, INSPIRE metadata)
- **GeoNetwork** (metadata catalogue instances — one per "viewer")
- **Consumers** (map viewers, external apps)

All HTTP handlers live in `src/api/` and are deployed as Netlify serverless functions. `netlify.toml` routes `/api/*` → `/.netlify/functions/:splat` and `/` → the `index` function.

Utility code is in `src/lib/`. Standalone maintenance scripts are in `src/scripts/`.

### Data model key concepts

- A **Viewer** (top-level `menu` item) has one GeoNetwork instance (`geonetwork { baseUrl, username, password }`) and a list of `errorNotificationContacts`.
- A **Menu** is a recursive tree (`children`) built from flat DatoCMS records via `buildMenuTree` / `buildChildrenTree`.
- A **ViewerLayer** links a **Layer** (WMS layer definition) to a viewer menu, and holds either `inspireMetadata` or `factsheets` (the `useFactsheetAsMetadata` flag determines which drives the XML).
- A **Factsheet** is a rich dataset description used both as a human-readable HTML page and as the source for ISO 19139 XML uploaded to GeoNetwork.

### Sync flow (webhook endpoints)

`sync-layer-background` and `sync-viewer-layer-background` are DatoCMS webhook targets:

1. Authenticated via `x-api-key: SYNC_LAYER_API_TOKEN`.
2. Load the full menu tree from DatoCMS.
3. Walk the tree to find which GeoNetwork instance(s) host the changed item (`findGeonetworkInstances`).
4. Fetch the appropriate XML (`fetchLayerXML` / `fetchViewerLayerXML`), which calls the layer's WMS `GetCapabilities` and merges it with DatoCMS metadata.
5. PUT the XML to GeoNetwork (OVERWRITE on publish, plain PUT on create) then upload thumbnails.
6. On any error, send an HTML error email via Mailjet to the viewer's `errorNotificationContacts`. The endpoint always returns `202`.

## Commands

```bash
# Start local dev server (API available at http://localhost:8080)
npm run dev          # wraps: netlify dev -p 8080

# Maintenance scripts (no server required)
npm run sync-external-metadata   # sync external metadata to GeoNetwork
npm run report                   # report dead WMS layer links via email
```

No test suite exists in this repository.

## Key Conventions

### Function handler pattern
Every `src/api/*.js` file exports a `handler` wrapped in `withServerDefaults` (from `src/lib/with-server-defaults.js`). The wrapper adds `statusCode: 200`, CORS headers (`Access-Control-Allow-Origin: *`), and catches unhandled errors → `500`.

```js
export const handler = withServerDefaults(async (event, _) => {
  // read event.queryStringParameters or event.body
  return { body: '...', headers: { 'content-type': '...' } }
})
```

### DatoCMS queries
All DatoCMS access goes through `datocmsRequest` (curried, in `src/lib/datocms.js`). It auto-paginates using `_all<Model>Meta { count }` companion queries. Use the tagged template literal `/* graphql */` on query strings (enables IDE syntax highlighting).

```js
const data = await datocmsRequest({ query, variables: { id }, preview: true, token: overrideToken })
```

- Default token: `DATO_API_TOKEN` env var.
- Preview environment: pass `preview: true` (used in sync-viewer-layer-background).
- Default pagination: 100 items per page; supply `_all<Model>Meta { count }` in the query to enable auto-pagination.

### GeoNetwork client
`src/lib/geonetwork.js` exports a `Geonetwork` class. It authenticates via XSRF token from `/me` + Basic Auth on every request. The constructor accepts `(baseUrl, username, password)` where `baseUrl` must end at `.../geonetwork/srv/api`. TLS verification is disabled (`rejectUnauthorized: false`).

### XML generation
XML for GeoNetwork is produced by:
- `src/lib/format-inspire-metadata-xml.js` — INSPIRE / ISO 19139 from `inspireMetadata` DatoCMS fields
- `src/lib/format-factsheet-xml.js` — ISO 19139 derived from a `factsheet` record
- `src/lib/external-metadata-utils.js` / `xml-transformer.js` — transform externally fetched XML

`src/lib/metadata-formats.js` detects the XML dialect of an externally fetched document so it can be converted to ISO 19139 by GeoNetwork.

### ES Modules
The project uses `"type": "module"` (ESM). Use `import`/`export` throughout; no `require()`.

### Environment variables
See `.env.example` for required variables. Scripts that target specific DatoCMS instances use per-instance tokens (`DATO_API_KEY_<INSTANCE>`). Set `SKIP_GEONETWORK_PUBLISH = true` inside a script to do a dry run without publishing.
