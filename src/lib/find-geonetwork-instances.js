function findGeonetworkInstances(menuTree, layerData) {
  const geonetworkInstances = new Map()

  menuTree.forEach((viewer) => {
    const findInMenu = (menu) => {
      const { children } = menu

      if (children) {
        children.forEach((child) => {
          if (child.id === layerData.entity.id) {
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

module.exports = {
  findGeonetworkInstances,
}
