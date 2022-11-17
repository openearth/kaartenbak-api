const { geonetworkRecordsRequest } = require('../lib/geonetwork')
const { datocmsClient } = require('../lib/datocms')
const { datocmsRequest } = require('../lib/datocms')
const fetch = require('node-fetch')
const { addThumbnailsToRecord } = require('../lib/add-thumbnails-to-record')
const { withServerDefaults } = require('../lib/with-server-defaults')

const query = /* graphql */ `
query LayerById($id: ItemId) {
  layer(filter: {id: {eq: $id}}) {
    thumbnails {
      filename
      url
    }
  }
}`

function fetchLayerXML(layerId) {
  /* 
    node-fetch doesn't allow relative urls,
    so we use an absolute url here by using
    an environment variable that refers
    to the url of the API
  */
  return fetch(
    process.env.API_URL + `/api/layer?id=${layerId}&format=xml`
  ).then((res) => res.text())
}

exports.handler = withServerDefaults(async (event, _) => {
  /* Protect this endpoint by means of a token */
  if (process.env.SYNC_LAYER_API_TOKEN !== event.headers['x-api-key']) {
    return {
      statusCode: 401,
    }
  }

  const layerData = JSON.parse(event.body)

  switch (layerData.event_type) {
    case 'create': {
      const xml = await fetchLayerXML(layerData.entity.id)

      const request = await geonetworkRecordsRequest({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: xml,
      })

      await datocmsClient.items.update(layerData.entity.id, {
        geonetwerk_id: request.uuid,
      })

      break
    }

    case 'publish': {
      const xml = await fetchLayerXML(layerData.entity.id)

      await geonetworkRecordsRequest({
        url: '?uuidProcessing=OVERWRITE',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: xml,
      })

      break
    }

    case 'delete':
      await geonetworkRecordsRequest({
        url: `/${layerData.entity.attributes.geonetwerk_id}`,
        method: 'DELETE',
      })

      break
  }

  switch (layerData.event_type) {
    case 'create':
    case 'publish':
      const id = layerData.entity.id

      const {
        layer: { thumbnails },
      } = await datocmsRequest({
        query,
        variables: { id },
      })

      await addThumbnailsToRecord(thumbnails, id)
  }
})
