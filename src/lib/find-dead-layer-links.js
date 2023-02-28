import buildWmsLayer from './build-wms-layer.js'
import { getWmsCapabilities, getLayerProperties } from './get-capabilities.js'
import { cachedFetch } from './cached-fetch.js'

function fetchWmsLayer(url) {
  return cachedFetch({
    url,
    resolveResponseFunction: (res) => {
      if (res.headers.get('content-type') !== 'image/png') {
        return true
      }
      return false
    },
  }).catch(() => true)
}

export async function findDeadLayerLinks(menuTree) {
  const findInMenu = async (menus) => {
    const menuItems = []

    for (const menu of menus) {
      const { name, children } = menu

      if (children) {
        const childItems = await findInMenu(children)
        const { deadLinksReportContacts } = menu

        menuItems.push({
          name,
          ...(childItems.length && { children: childItems }),
          ...(deadLinksReportContacts?.length && { deadLinksReportContacts })
        })
      }

      const { url, layer } = menu

      if (url && layer) {
        const { requestPath, linkIsDead, document } = await getWmsCapabilities(
          url
        )

        if (linkIsDead) {
          menuItems.push({
            name,
            linkState: {
              link: requestPath,
              linkIsDead,
            },
          })
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

          menuItems.push({
            name,
            linkState: {
              link: requestUrl,
              linkIsDead,
            },
          })
        }
      }
    }

    return menuItems
  }

  return findInMenu(menuTree)
}
