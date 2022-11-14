const FormData = require('form-data')
const { geonetworkRequest } = require('../lib/geonetwork')
const fetch = require('node-fetch')

const url = '/records'

export async function addThumbnailsToRecord(thumbnails, recordId) {
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
    headers: {
      'Content-Type': 'application/json',
    },
  })

  for (const attachment of attachments) {
    await geonetworkRequest({
      url:
        url +
        `/${attachment.metadataId}/processes/thumbnail-remove?thumbnail_url=${attachment.url}&process=thumbnail-remove&id=${attachment.metadataId}`,
      method: 'POST',
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

    await geonetworkRequest({
      url:
        url +
        `/${attachment.metadataId}/processes/thumbnail-add?thumbnail_url=${attachment.url}&thumbnail_desc=&process=thumbnail-add&id=${attachment.metadataId}`,
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