import fetch from 'node-fetch'
import convert from 'xml-js'

function recursivelyFindLayer(layers, name) {
  const layerList = Array.isArray(layers)
    ? layers
    : [layers]

  // A workspace-scoped WMS endpoint (e.g. `<geoserver>/<workspace>/wms`)
  // returns layer names without their `<workspace>:` prefix, even though
  // `name` (the DatoCMS-configured WMS layer name) is workspace-qualified.
  // Fall back to matching the unqualified name too, as done in
  // https://github.com/openearth/rws-viewer/blob/main/src/lib/get-capabilities.js
  const nameWithoutWorkspace = name?.includes(':') ? name.split(':')[1] : null

  for (let layer of layerList) {
    if (layer.Name && (layer.Name._text === name || layer.Name._text === nameWithoutWorkspace)) {
      return layer
    }

    if (layer.Layer) {
      const foundLayer = recursivelyFindLayer(layer.Layer, name)
      if (foundLayer) {
        return foundLayer
      }
    }
  }

  return null
}

// Some layers are configured (in DatoCMS) with GeoServer's GeoWebCache (GWC)
// endpoint (`.../gwc/service/wmts`) instead of a plain WMS endpoint, since
// that's what the map viewer uses for tiled rendering. GWC only understands
// WMTS and returns a WMTS capabilities document (no per-layer Abstract/
// bounding box in the WMS sense) regardless of `service=WMS` being requested.
// GeoServer always exposes a matching per-workspace WMS endpoint at
// `<geoserver-host>/<workspace>/wms`, so derive that from the WMS layer name
// (`<workspace>:<layer>`) and use it instead, following the approach used in
// https://github.com/openearth/rws-viewer/blob/main/src/lib/get-capabilities.js
function resolveWmsUrl(url, layerName) {
  const isGwcWmtsUrl = /\/gwc\/service\/wmts\/?$/.test(url)

  if (!isGwcWmtsUrl) {
    return url
  }

  const [workspace] = layerName?.includes(':') ? layerName.split(':') : []

  return workspace
    ? url.replace(/\/gwc\/service\/wmts\/?$/, `/${workspace}/wms`)
    : url.replace(/\/gwc\/service\/wmts\/?$/, '/wms')
}

// Fetches a layer's live WMS `GetCapabilities` info (used to enrich the
// INSPIRE/ISO19139 metadata with the layer's own Abstract, CRS and bounding
// box). Returns null (rather than throwing) whenever the capabilities can't
// be fetched, parsed, or don't contain a matching layer, so callers can just
// skip the WMS-derived fields instead of failing the whole request.
export async function fetchLayerInfo(url, layerName, httpsAgent) {
  if (!url || !layerName) {
    return null
  }

  const wmsUrl = resolveWmsUrl(url, layerName)

  let capabilitiesXml

  try {
    capabilitiesXml = await fetch(`${wmsUrl}?service=WMS&request=GetCapabilities`, {
      agent: httpsAgent,
    }).then((res) => res.text())
  } catch (error) {
    console.log(`Failed fetching WMS capabilities from ${wmsUrl}: ${error.message}`)
    return null
  }

  let capabilities

  try {
    capabilities = JSON.parse(
      convert.xml2json(capabilitiesXml, {
        compact: true,
      })
    )
  } catch (error) {
    console.log(`Failed parsing WMS capabilities from ${wmsUrl}: ${error.message}`)
    return null
  }

  // Support both WMS 1.3.0 (WMS_Capabilities) and WMS 1.1.1 (WMT_MS_Capabilities)
  const root = capabilities.WMS_Capabilities || capabilities.WMT_MS_Capabilities

  if (!root?.Capability?.Layer) {
    return null
  }

  return recursivelyFindLayer(root.Capability.Layer, layerName)
}
