const { datocmsRequest } = require('../lib/datocms')

const datocmsQuery = /* graphql */ `
query Layers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    name
    children: layers {
      id
      name
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

function findLayers(menu, query, foundLayers = []) {
  menu &&
    Object.keys(menu).forEach((key) => {
      if (typeof menu[key] === 'object') {
        findLayers(menu[key], query, foundLayers)
      }

      if (
        key.match('indexableWfsProperties') &&
        menu?.indexableWfsProperties?.some((property) =>
          property?.keywords?.includes(query)
        )
      ) {
        const { id, name } = menu

        foundLayers.push({
          id,
          name,
        })
      }
    })

  return foundLayers
}

exports.handler = async (event, context) => {
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

  try {
    const { menus } = await datocmsRequest({ query: datocmsQuery })

    buildChildrenTree(menus)

    const menu = menus.find((menu) => menu.name === viewer)

    if (!menu) {
      return {
        statusCode: 404,
        body: 'Viewer not found',
        'Access-Control-Allow-Origin': '*',
      }
    }

    const layers = findLayers(menu, query)

    return {
      statusCode: 200,
      body: JSON.stringify(layers),
      'Access-Control-Allow-Origin': '*',
      'content-type': 'application/json',
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed fetching data' }),
    }
  }
}
