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

export function* traverseMenuLayers(menuTree, topMostViewer = null) {
  for (const menu of menuTree) {
    //const menuContacts = [...contacts, ...menu.deadLinksReportContacts ?? []]

    if(menu.layer) {
      yield {
        name: menu.name,
        url: menu.url,
        layer: menu.layer,
        viewer: topMostViewer,
      }
    } else if(menu.children) {
      yield* traverseMenuLayers(menu.children, topMostViewer ?? menu)
    }
  }
}

export function getViewerAndLayers(menuTree) {
  const viewers = []

  function recursivelyFindLayers(menuTree) {
    return menuTree.reduce((layers, menu) => {
      if(menu.layer) {
        return [...layers, menu]
      } else if(menu.children) {
        return [...layers, ...recursivelyFindLayers(menu.children)]
      }
    }, [])
  }

  for(const viewer of menuTree) {
    const item = {
      viewer,
      layers: recursivelyFindLayers(viewer.children)
    }

    viewers.push(item)
  }

  return viewers
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
            link: requestPath,
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

          if (linkIsDead) {
            menuItems.push({
              name,
              link: requestUrl,
            })
          }
        }
      }
    }

    return menuItems
  }

  return findInMenu(menuTree)
}
