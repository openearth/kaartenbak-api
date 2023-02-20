const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    geonetwork {
      baseUrl
      username
      password
    }
    children: layers {
      id
    }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}`

module.exports = {
  viewersWithLayersQuery,
}
