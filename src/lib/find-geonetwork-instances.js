export function findGeonetworkInstances(menuTree, id) {
  const geonetworkInstances = new Map()

  console.log('searching for geonetwork instances with id', id)

  menuTree.forEach((viewer) => {
    const findInMenu = (menu) => {
      const { children } = menu

      if (children) {
        children.forEach((child) => {
          if (child.id === id) {
            const { geonetwork } = viewer

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
