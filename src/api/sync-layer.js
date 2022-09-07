const { geonetworkRequest } = require('../lib/geonetwork')
const { datocmsClient } = require('../lib/datocms')

const url = '/records'

exports.handler = async (event, context) => {
  try {
    const layerData = JSON.parse(event.body)

    switch (layerData.event_type) {
      case 'create':
        const request = await geonetworkRequest({
          url:
            url +
            '?url=' +
            encodeURIComponent(
              `https://kaartenbak.netlify.app/api/layer?id=${layerData.entity.id}&format=xml`
            ),
          method: 'PUT',
        })

        await datocmsClient.items.update(layerData.entity.id, {
          geonetwerk_id: request.uuid,
        })

        break
      case 'publish':
        await geonetworkRequest({
          url:
            url +
            '?uuidProcessing=OVERWRITE&url=' +
            encodeURIComponent(
              `https://kaartenbak.netlify.app/api/layer?id=${layerData.entity.id}&format=xml`
            ),
          method: 'PUT',
        })

        break
      case 'delete':
        await geonetworkRequest({
          url: url + `?uuids=${layerData.entity.attributes.geonetwerk_id}`,
          method: 'DELETE',
        })

        break
    }

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed fetching data' }),
    }
  }
}
