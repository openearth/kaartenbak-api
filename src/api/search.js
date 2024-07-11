import { datocmsRequest } from '../lib/datocms'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildChildrenTree } from '../lib/build-children-tree'
import { formatMenusRecursive } from '../lib/format-menu'

const datocmsQuery = /* graphql */ `
query Layers ($first: IntType, $skip: IntType = 0, $locale: SiteLocale = nl) {
  menus: allMenus(first: $first, skip: $skip, locale: $locale) {
    id
    name
    children: viewerLayers {
      layer {
        id
        name
        description
        indexableWfsProperties
      }
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

function isMatchCaseInsensitive(value, search) {
  return value?.toLowerCase().indexOf(search) > -1
}

function layerMatches(indexableWfsProperties, name, description, query) {
  return (
    indexableWfsProperties?.some((property) =>
      property?.keywords?.some((keyword) =>
        isMatchCaseInsensitive(keyword, query)
      )
    ) ||
    isMatchCaseInsensitive(name, query) ||
    isMatchCaseInsensitive(description, query)
  )
}

// Find layers recursively by matching them to the search query
function findLayers(menu, query) {
  const foundLayers = []

  const findInMenu = (menus) => {
    for (const menu of menus) {
      const { children } = menu

      if (children) {
        findInMenu(children)
      }

      const { name, description, indexableWfsProperties } = menu
    
      if (layerMatches(indexableWfsProperties, name, description, query)) {
        const { id } = menu
    
        foundLayers.push({
          id,
          name,
          description,
        })
      }
    }
  }

  findInMenu([menu])

  return foundLayers
}

export const handler = withServerDefaults(async (event, _) => {
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
  const formattedMenus = formatMenusRecursive(menus)

  buildChildrenTree(formattedMenus)

  const menu = formattedMenus.find((menu) => menu.name === viewer)

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
