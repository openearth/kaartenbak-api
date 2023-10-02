import { Geonetwork } from '../lib/geonetwork'
import { datocmsRequest, datocmsClient } from '../lib/datocms'
import { addThumbnailsToRecord } from '../lib/add-thumbnails-to-record'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildMenuTree } from '../lib/build-menu-tree'
import { findGeonetworkInstances } from '../lib/find-geonetwork-instances'
import { fetchLayerXML } from '../lib/fetch-layer-xml'

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

const menuTreePromise = loadMenuTree()

export const handler = withServerDefaults(async (event, _) => {
  /* Protect this endpoint by using a token */
  if (process.env.SYNC_LAYER_API_TOKEN !== event.headers['x-api-key']) {
    return {
      statusCode: 401,
    }
  }

  const pluginData = await getPluginData()
  const changedLayers = pluginData.parameters.changedLayers

  for await(let layerId of changedLayers) {
    console.log(`Updating layer: ${layerId}`)
    
    await updateLayer(layerId)
  }

  await unmarkLayers(pluginData.id)
})

async function getPluginData() {
  const PLUGIN_NAME = 'Mark layers as changed'

  const plugins = await datocmsClient.plugins.list()
  
  return plugins.find(plugin => plugin.name === PLUGIN_NAME)
}

async function unmarkLayers(pluginId) {
  await datocmsClient.plugins.update(pluginId, {
    parameters: {
      changedLayers: []
    }
  })
}

async function loadMenuTree() {
    const { menus } = await datocmsRequest({
        query: viewersWithLayersQuery,
    })
    return buildMenuTree(menus)
}

async function updateLayer(layerId) {
  const menuTree = await menuTreePromise

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
}