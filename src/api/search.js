const { datocmsRequest } = require('../lib/datocms')
const { withServerDefaults } = require('../lib/with-server-defaults')

const datocmsQuery = /* graphql */ `
query Layers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    name
    children: layers {
      id
      name
      description
      indexableWfsProperties
    }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}
`

function buildChildrenTree(items) {
  items.forEach((item) => {
    if (item.parent) {
      const parent = items.find((p) => p.id === item.parent.id)
      if (parent.children == null) {
        parent.children = []
      }
      parent.children.push(item)
    }
  })
}

function isMatchCaseInsensitive(value, search) {
  return value?.toLowerCase().indexOf(search) > -1
}

function layerMatches(key, indexableWfsProperties, name, description, query) {
  return (
    key.match('indexableWfsProperties') &&
    indexableWfsProperties?.some(
      (property) =>
        property?.keywords?.some((keyword) =>
          isMatchCaseInsensitive(keyword, query)
        ) ||
        isMatchCaseInsensitive(name, query) ||
        isMatchCaseInsensitive(description, query)
    )
  )
}

// Find layers recursively by matching them to the search query
function findLayers(menu, query, foundLayers = []) {
  menu &&
    Object.keys(menu).forEach((key) => {
      if (typeof menu[key] === 'object') {
        findLayers(menu[key], query, foundLayers)
      }

      const { name, description, indexableWfsProperties } = menu

      if (layerMatches(key, indexableWfsProperties, name, description, query)) {
        const { id } = menu

        foundLayers.push({
          id,
          name,
          description,
        })
      }
    })

  return foundLayers
}

exports.handler = withServerDefaults(async (event, _) => {
  const { viewer, query } = event.queryStringParameters

  if (!viewer) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'viewer query parameter is required' }),
    }
  }

  if (!query) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'query query parameter is required' }),
    }
  }

  const { menus } = await datocmsRequest({ query: datocmsQuery })

  buildChildrenTree(menus)

  const menu = menus.find((menu) => menu.name === viewer)

  if (!menu) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'viewer not found' }),
    }
  }

  const lowerCaseQuery = query.toLowerCase()
  const layers = findLayers(menu, lowerCaseQuery)

  return {
    body: JSON.stringify(layers),
  }
})
