import { map, pipe } from 'ramda'
import jsdom from 'jsdom'
import { cachedFetch } from './cached-fetch.js'

const getTagContent = (tag) => tag?.textContent
const getParentNode = (tag) => tag?.parentNode
const textToArray = (text) => text.split(',')

const getTags = (tagName) => (root) => {
  if (!root?.length) {
    return []
  }

  return [...root].map((el) => [...el.getElementsByTagName(tagName)]).flat()
}

const findLayer = (id) => (layers) => {
  let layer = layers.find((layer) => layer.textContent === id)
  if (layer) {
    return layer
  } else {
    const idWithoutWorkspace = id.split(':')[1]
    layer = layers.find((layer) => layer.textContent === idWithoutWorkspace)
    return layer
  }
}

function readBbox(bboxElement) {
  const bbox = [
    [
      bboxElement?.getElementsByTagName('westBoundLongitude')[0].textContent,
      bboxElement?.getElementsByTagName('southBoundLatitude')[0].textContent,
    ],
    [
      bboxElement?.getElementsByTagName('eastBoundLongitude')[0].textContent,
      bboxElement?.getElementsByTagName('northBoundLatitude')[0].textContent,
    ],
  ]
  return bbox
}

export async function getWmsCapabilities(service) {
  const serviceUrl = new URL(service)
  const servicePath = `${serviceUrl.origin}${serviceUrl.pathname}`
  const requestPath = `${servicePath}?service=WMS&request=GetCapabilities`

  const data = await cachedFetch({
    url: requestPath,
    resolveResponseFunction: (res) => res.text(),
  }).catch(() => undefined)

  if (!data) {
    return {
      requestPath,
      linkIsDead: true,
      document: null,
    }
  }

  const { JSDOM } = jsdom
  const DOMParser = new JSDOM().window.DOMParser

  return {
    requestPath,
    linkIsDead: false,
    document: new DOMParser().parseFromString(data, 'text/xml'),
  }
}

export function getLayerProperties(capabilities, layer) {
  /**
   * function that reads the wms capabilities response of the workpspace
   * 1. find the given layer
   * 2. extracts:
   *    -wmsVersion
   *    -bbox of layer
   *    -keywords (that contain the service type)
   *    -service type of layer (wfs or wcs)
   *    -time extent of layer
   *
   *  * */

  const wmsVersion = pipe(
    () => capabilities.querySelector('WMS_Capabilities'),
    (el) => el?.getAttribute('version')
  )()

  const bbox = pipe(
    () => [
      ...capabilities.querySelectorAll(
        '[queryable="1"], [queryable="0"], [opaque="0"]'
      ),
    ],
    getTags('Name'),
    findLayer(layer),
    getParentNode,
    (el) => el?.querySelector('EX_GeographicBoundingBox'),
    readBbox
  )()

  const keywords = pipe(
    () => [
      ...capabilities.querySelectorAll(
        '[queryable="1"], [queryable="0"], [opaque="0"]'
      ),
    ],
    getTags('Name'),
    findLayer(layer),
    getParentNode,
    (el) => el?.getElementsByTagName('KeywordList'),
    getTags('Keyword'),
    map(getTagContent)
  )()
  const serviceType = ['features', 'wfs', 'FEATURES', 'WFS'].some((val) =>
    keywords.includes(val)
  )
    ? 'wfs'
    : ['WCS', 'GeoTIFF', 'wcs'].some((val) => keywords.includes(val))
    ? 'wcs'
    : null

  const timeExtent = pipe(
    () => [
      ...capabilities.querySelectorAll(
        '[queryable="1"], [queryable="0"], [opaque="0"]'
      ),
    ],
    getTags('Name'),
    findLayer(layer),
    getParentNode,
    (el) => [...(el?.getElementsByTagName('Dimension') ?? [])],
    map(getTagContent),
    map(textToArray),
    (array) => array.flat()
  )()

  return { serviceType, timeExtent, wmsVersion, bbox }
}
