const { geonetworkRequest } = require('../lib/geonetwork')
const { datocmsClient } = require('../lib/datocms')
const { datocmsRequest } = require('../lib/datocms')
const fetch = require('node-fetch')
const FormData = require('form-data')

const url = '/records'

const query = /* graphql */ `
query LayerById($id: ItemId) {
  layer(filter: {id: {eq: $id}}) {
    thumbnails {
      filename
      url
    }
    useFactsheetAsMetadata
  }
}`

async function addThumbnailsToRecord(thumbnails, recordId) {
  const formThumbnails = await Promise.all(
    thumbnails.map(async (thumbnail) => {
      const blob = await fetch(thumbnail.url).then((res) => res.blob())
      const arrayBuffer = await blob.arrayBuffer()
      const form = new FormData()
      form.append('file', Buffer.from(arrayBuffer), thumbnail.filename)

      return form
    })
  )

  const attachments = await geonetworkRequest({
    url: url + `/${recordId}/attachments`,
    method: 'GET',
  })

  for (const attachment of attachments) {
    await geonetworkRequest({
      url:
        url +
        `/${attachment.metadataId}/processes/thumbnail-remove?thumbnail_url=${attachment.url}&process=thumbnail-remove&id=${attachment.metadataId}`,
      method: 'POST',
      headers: {
        Accept: 'application/xml',
      },
      options: {
        responseText: true,
      },
    })
  }

  await geonetworkRequest({
    url: url + `/${recordId}/attachments`,
    method: 'DELETE',
    options: {
      responseText: true,
    },
  })

  for (const formThumbnail of formThumbnails) {
    const attachment = await geonetworkRequest({
      url: url + `/${recordId}/attachments`,
      method: 'POST',
      body: formThumbnail,
    })

    // console.log(attachment)

    await geonetworkRequest({
      url:
        url +
        `/${attachment.metadataId}/processes/thumbnail-add?thumbnail_url=${attachment.url}&thumbnail_desc=&process=thumbnail-add&id=${attachment.metadataId}`,
      method: 'POST',
      headers: {
        Accept: 'application/xml',
      },
      options: {
        responseText: true,
      },
    })
  }
}

exports.handler = async (event, context) => {
  try {
    if (process.env.SYNC_LAYER_API_TOKEN !== event.headers['x-api-key']) {
      return {
        statusCode: 401,
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    }

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
          headers: {
            'Content-Type': 'application/json',
          }
        })

        console.log(request)

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
          headers: {
            'Content-Type': 'application/json',
          }
        })

        break
      case 'delete':
        await geonetworkRequest({
          url: url + `/${layerData.entity.attributes.geonetwerk_id}`,
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        break
    }

    switch (layerData.event_type) {
      case 'create':
      case 'publish':
        const {
          layer: { thumbnails, useFactsheetAsMetadata },
        } = await datocmsRequest({
          query,
          variables: { id: layerData.entity.id },
        })

        const id =
          (useFactsheetAsMetadata ? 'factsheet' : 'layer') +
          `-${layerData.entity.id}`

        // await addThumbnailsToRecord(thumbnails, id)
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
