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
