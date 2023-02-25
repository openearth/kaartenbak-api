import dotenv from 'dotenv'
dotenv.config({
  path: '../../.env',
})

import jsdom from 'jsdom'

const { JSDOM } = jsdom
global.DOMParser = new JSDOM().window.DOMParser

import util from 'util'
import fetch from 'node-fetch'
import { map, pipe } from 'ramda'

import { datocmsRequest } from '../lib/datocms.js'
import { buildMenuTree } from '../lib/build-menu-tree.js'
import { stringify } from 'query-string'
import https from 'https'

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    name
    children: layers {
      id
      name
      url
      layer
    }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}`

const getTagContent = (tag) => tag?.textContent
const getParentNode = (tag) => tag?.parentNode
const textToArray = (text) => text.split(',') //split at comma

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
  /**
   * The getWmsCapabilitis is made when a layer is clicked.
   *
   * */
  //the getcapabilities returns the capabilities of the layers in the workspace. need to search for the layer first

  const serviceUrl = new URL(service)
  const servicePath = `${serviceUrl.origin}${serviceUrl.pathname}`
  const requestPath = `${servicePath}?service=WMS&request=GetCapabilities`

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })

  const data = await fetch(requestPath, {
    agent: httpsAgent,
  })
    .then((res) => res.text())
    .catch(() => undefined)

  if (!data) {
    return {
      requestPath,
      linkIsDead: true,
      document: null,
    }
  }

  return {
    requestPath,
    linkIsDead: false,
    document: new DOMParser().parseFromString(data, 'text/xml'),
  }
}

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

export function buildGeoserverUrl({
  url,
  service,
  request,
  encode = true,
  width = 256,
  height = 256,
  ...rest
}) {
  if (!service || !request) {
    return undefined
  }

  const params = stringify(
    { service, request, width, height, ...rest },
    { encode, sort: false }
  )

  return `${url}?${params}`
}

export function buildWmsLayer({
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

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

export async function findDeadLayerLinks(menuTree) {
  const menuTreeItems = []

  for (const viewer of menuTree) {
    const findInMenu = async (menu) => {
      const { children } = menu
      const menuItems = []

      if (children) {
        for (const child of children) {
          const { url, layer } = child
          let linkState = {}

          if (url && layer) {
            const { requestPath, linkIsDead, document } =
              await getWmsCapabilities(url)

            if (linkIsDead) {
              linkState = {
                link: requestPath,
                linkIsDead,
              }
            } else {
              const { serviceType, timeExtent, wmsVersion, bbox } =
                getLayerProperties(document, layer)

              const requestUrl = buildWmsLayer({
                ...child,
                ...{ serviceType },
                ...{ timeExtent },
                ...{ version: wmsVersion },
                ...{ bbox },
              })

              const linkIsDead = await fetch(requestUrl, {
                agent: httpsAgent,
              })
                .then((res) => {
                  console.log(res.headers.get('content-type'))
                  if (res.headers.get('content-type') !== 'image/png') {
                    return true
                  }
                  return false
                })
                .catch(() => true)

              linkState = {
                link: requestUrl,
                linkIsDead,
              }
            }
          }

          console.log(linkState)

          const childItems = await findInMenu(child)

          menuItems.push({
            name: child.name,
            ...(!childItems.length && { linkState }),
            ...(childItems.length && { children: childItems }),
          })
        }
      }

      return menuItems
    }

    menuTreeItems.push({
      name: viewer.name,
      children: await findInMenu(viewer),
    })
  }

  return menuTreeItems
}

import { spawn } from 'child_process'

function pbcopy(data) {
  var proc = spawn('pbcopy')
  proc.stdin.write(data)
  proc.stdin.end()
}

import deadLayerLinks from './links.json' assert { type: 'json' }

function filterDeadLayerLinks(deadLayerLinks) {
  const deadLayerLinksCopy = JSON.parse(JSON.stringify(deadLayerLinks))

  const filter = (menus) => {
    for (const [index, menu] of menus.entries()) {
      const { children } = menu

      if (children) {
        filter(children)
        menu.children = menu.children.filter((item) => item)
      }

      if (
        menu?.linkState?.linkIsDead === false ||
        menu?.children?.length === 0
      ) {
        delete menus[index]
      }
    }
  }

  filter(deadLayerLinksCopy)

  return deadLayerLinksCopy.filter((viewer) => viewer)
}

async function report() {
  // const { menus } = await datocmsRequest({
  //   query: viewersWithLayersQuery,
  // })

  // const menuTree = buildMenuTree(menus)

  // const deadLayerLinks = await findDeadLayerLinks(menuTree)

  // pbcopy(JSON.stringify(deadLayerLinks))

  console.dir(filterDeadLayerLinks(deadLayerLinks), { depth: null })

  // filterDeadLayerLinks(deadLayerLinks)
}

report()
