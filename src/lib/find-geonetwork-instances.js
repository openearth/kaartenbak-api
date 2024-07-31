export function findGeonetworkInstances(menuTree, layerId) {
  const geonetworkInstances = new Map()

  console.log('menuTree: ', menuTree)

  menuTree.forEach((viewer) => {
    const findInMenu = (menu) => {
      const { children } = menu

      if (children) {
        children.forEach((child) => {
          if (child.id === layerId) {

            const { geonetwork } = viewer

            console.log('geonetwork found!!', geonetwork)

            if (geonetwork) {
              let baseUrl = new URL(geonetwork.baseUrl)
              baseUrl = baseUrl.toString()
              geonetwork.baseUrl = baseUrl
              geonetworkInstances.set(baseUrl, geonetwork)
            }
          }

          findInMenu(child)
        })
      }
    }

    findInMenu(viewer)
  })

  return geonetworkInstances
}
