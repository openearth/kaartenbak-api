import buildGeoserverUrl from './build-geoserver-url.js'

export default function ({
  url: rawUrl,
  layer,
  styles = '',
  time,
  filter,
  version,
  bbox,
}) {
  const url = new URL(rawUrl)
  const searchParamEntries = url.searchParams.entries()
  const searchParamsObject = Object.fromEntries(searchParamEntries)

  return buildGeoserverUrl({
    url: url.origin + url.pathname,
    service: 'WMS',
    request: 'GetMap',
    layers: layer,
    styles,
    width: 256,
    height: 256,
    version,
    ...(time && { time: time }),
    ...(filter && { cql_filter: filter }),
    crs: 'EPSG:3857',
    transparent: true,
    bbox: bbox.flat().join(','),
    format: 'image/png',
    encode: false,
    ...searchParamsObject,
  })
}
