# Kaartenbak API

API Layer on top of [Kaartenbak CMS](https://ihm-kaarten-bak.admin.datocms.com/), using [Netlify functions](https://docs.netlify.com/functions/overview/).

## API Endpoints

* `/`
  * Returns an overview of all factsheets in HTML
* `/api/factsheet?id=${id}&format=${format}`
  * Returns factsheet details in either HTML or JSON
  * Where `id` is the factsheet id
  * Where `format` is either `html` or `json` 
* `/api/layer?id=${id}&format=${format}`
  * Returns layer metadata in either XML or JSON
  * Where `id` is the layer id
  * Where `format` is either `xml` or `json`
* `/api/search?viewer=${viewer}&query=${query}`
  * Returns layers of a viewer in JSON
  * Where `viewer` is the viewer name
  * Where `query` is the search query
* `/api/sync-layer`
  * Meant for the webhook of DatoCMS Kaartenbak. See below for the details.
* `/api/sync-viewer-layer`
  * Meant for the webhook of DatoCMS Kaartenbak. See below for the details.

## How synchronising DatoCMS Kaartenbak Layer to Geonetwork works

![Synchronising layer](/docs/sync-layer.svg)

## External Metadata Synchronization

The project includes an automated process for synchronizing external metadata between different systems. This functionality is implemented in the `src/scripts/sync-external-metadata.js` file and scheduled via GitHub Actions.

### How the External Metadata Sync Works

The sync-external-metadata script performs the following operations:

1. Connects to multiple DatoCMS instances (configured in the `instances` array)
2. Retrieves menu structures with layer information from each instance
3. Identifies layers with external metadata references
4. For each external metadata reference:
   - Fetches the metadata XML from the source URL
   - Transforms the XML by:
     - Adding thumbnails
     - Adding links
     - Replacing IDs
   - Uploads the transformed metadata to the destination Geonetwork instance

This process ensures that metadata is consistently synchronized across different systems, maintaining up-to-date information about layers and their properties.

### Automated Scheduling

The synchronization process runs automatically through GitHub Actions as defined in `.github/workflows/sync-external-metadata.yml`:

- Runs daily at midnight (via cron: '0 0 * * *')
- Can be manually triggered via workflow_dispatch
- Uses Node.js 20 for execution
- Requires specific DatoCMS API keys stored as GitHub secrets

This automation ensures that metadata remains synchronized without manual intervention, maintaining consistency across the connected systems.
