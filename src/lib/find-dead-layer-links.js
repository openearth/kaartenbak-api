import fetch from 'node-fetch'
import https from 'https'

import buildWmsLayer from './build-wms-layer.js'
import { getWmsCapabilities, getLayerProperties } from './get-capabilities.js'

const fetchResults = new Map()

async function fetchWmsLayer(url) {
  if (fetchResults.has(url)) {
    return fetchResults.get(url)
  }

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })

  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, 10000)

  const linkIsDead = await fetch(url, {
    agent: httpsAgent,
    signal: controller.signal,
  })
    .then((res) => {
      if (res.headers.get('content-type') !== 'image/png') {
        return true
      }
      return false
    })
    .catch(() => true)
    .finally(() => clearTimeout(timeout))

  fetchResults.set(url, linkIsDead)

  return linkIsDead
}

export async function findDeadLayerLinks(menuTree) {
  const findInMenu = async (menus) => {
    const menuItems = []

    for (const menu of menus) {
      const { name, children } = menu

      if (children) {
        const childItems = await findInMenu(children)

        menuItems.push({
          name,
          ...(childItems.length && { children: childItems }),
        })
      }

      const { url, layer } = menu

      if (url && layer) {
        let linkState = {}

        const { requestPath, linkIsDead, document } = await getWmsCapabilities(
          url
        )

        if (linkIsDead) {
          linkState = {
            link: requestPath,
            linkIsDead,
          }
        } else {
          const { serviceType, timeExtent, wmsVersion, bbox } =
            getLayerProperties(document, layer)

          const requestUrl = buildWmsLayer({
            ...menu,
            ...{ serviceType },
            ...{ timeExtent },
            ...{ version: wmsVersion },
            ...{ bbox },
          })

          const linkIsDead = await fetchWmsLayer(requestUrl)

          linkState = {
            link: requestUrl,
            linkIsDead,
          }
        }

        console.log(linkState)

        menuItems.push({
          name,
          linkState,
        })
      }
    }

    return menuItems
  }

  return findInMenu(menuTree)
}
