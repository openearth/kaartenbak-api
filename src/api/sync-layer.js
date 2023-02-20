const { Geonetwork } = require('../lib/geonetwork')
const { datocmsRequest } = require('../lib/datocms')
const { addThumbnailsToRecord } = require('../lib/add-thumbnails-to-record')
const { withServerDefaults } = require('../lib/with-server-defaults')
const { buildMenuTree } = require('../lib/build-menu-tree')
const { findGeonetworkInstances } = require('../lib/find-geonetwork-instances')
const { fetchLayerXML } = require('../lib/fetch-layer-xml')

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

const layerByIdQuery = /* graphql */ `
query LayerById($id: ItemId) {
  layer(filter: {id: {eq: $id}}) {
    thumbnails {
      filename
      url
    }
  }
}`

exports.handler = withServerDefaults(async (event, _) => {
  /* Protect this endpoint by using a token */
  if (process.env.SYNC_LAYER_API_TOKEN !== event.headers['x-api-key']) {
    return {
      statusCode: 401,
    }
  }

  const layerData = JSON.parse(event.body)

  const layerId = layerData.entity.id

  const { menus } = await datocmsRequest({
    query: viewersWithLayersQuery,
  })

  const menuTree = buildMenuTree(menus)

  const geonetworkInstances = findGeonetworkInstances(menuTree, layerId)

  const geonetworkInstancesArray = Array.from(geonetworkInstances)

  const xml = await fetchLayerXML({ id: layerId })

  const requestsPromises = geonetworkInstancesArray.map(
    async ([_, geonetworkInstance]) => {
      const { baseUrl, username, password } = geonetworkInstance

      const geonetwork = new Geonetwork(
        baseUrl + 'geonetwork/srv/api',
        username,
        password
      )

      switch (layerData.event_type) {
        case 'create': {
          await geonetwork.recordsRequest({
            url: '?publishToAll=true',
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: xml,
          })

          break
        }

        case 'publish': {
          await geonetwork.recordsRequest({
            url: '?uuidProcessing=OVERWRITE&publishToAll=true',
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: xml,
          })

          break
        }
      }

      switch (layerData.event_type) {
        case 'create':
        case 'publish':
          const {
            layer: { thumbnails },
          } = await datocmsRequest({
            query: layerByIdQuery,
            variables: { id: layerId },
          })

          await addThumbnailsToRecord(thumbnails, layerId, geonetwork)
      }
    }
  )

  await Promise.allSettled(requestsPromises)
})
