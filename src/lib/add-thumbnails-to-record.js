const FormData = require('form-data')
const { geonetworkRecordsRequest } = require('../lib/geonetwork')
const fetch = require('node-fetch')

export async function addThumbnailsToRecord(thumbnails, recordId) {
  const forms = await Promise.all(
    thumbnails.map(async (thumbnail) => {
      const blob = await fetch(thumbnail.url).then((res) => res.blob())
      const arrayBuffer = await blob.arrayBuffer()
      const form = new FormData()
      form.append('file', Buffer.from(arrayBuffer), thumbnail.filename)

      return form
    })
  )

  const attachments = await geonetworkRecordsRequest({
    url: `/${recordId}/attachments`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  for (const attachment of attachments) {
    await geonetworkRecordsRequest({
      url: `/${attachment.metadataId}/processes/thumbnail-remove?thumbnail_url=${attachment.url}&process=thumbnail-remove&id=${attachment.metadataId}`,
      method: 'POST',
      options: {
        responseText: true,
      },
    })
  }

  await geonetworkRecordsRequest({
    url: `/${recordId}/attachments`,
    method: 'DELETE',
    options: {
      responseText: true,
    },
  })

  for (const form of forms) {
    const attachment = await geonetworkRecordsRequest({
      url: `/${recordId}/attachments`,
      method: 'POST',
      body: form,
    })

    await geonetworkRecordsRequest({
      url: `/${attachment.metadataId}/processes/thumbnail-add?thumbnail_url=${attachment.url}&thumbnail_desc=&process=thumbnail-add&id=${attachment.metadataId}`,
      method: 'POST',
      headers: {
        accept: 'application/xml',
        'Content-Type': 'application/json',
      },
      options: {
        responseText: true,
      },
    })
  }
}
