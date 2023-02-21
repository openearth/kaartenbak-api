import FormData from 'form-data'
import fetch from 'node-fetch'

export async function addThumbnailsToRecord(thumbnails, recordId, geonetwork) {
  const forms = await Promise.all(
    thumbnails.map(async (thumbnail) => {
      const blob = await fetch(thumbnail.url).then((res) => res.blob())
      const arrayBuffer = await blob.arrayBuffer()
      const form = new FormData()
      form.append('file', Buffer.from(arrayBuffer), thumbnail.filename)

      return form
    })
  )

  const attachments = await geonetwork.recordsRequest({
    url: `/${recordId}/attachments`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  for (const attachment of attachments) {
    await geonetwork.recordsRequest({
      url: `/${attachment.metadataId}/processes/thumbnail-remove?thumbnail_url=${attachment.url}&process=thumbnail-remove&id=${attachment.metadataId}`,
      method: 'POST',
      options: {
        responseText: true,
      },
    })
  }

  await geonetwork.recordsRequest({
    url: `/${recordId}/attachments`,
    method: 'DELETE',
    options: {
      responseText: true,
    },
  })

  for (const form of forms) {
    const attachment = await geonetwork.recordsRequest({
      url: `/${recordId}/attachments`,
      method: 'POST',
      body: form,
    })

    await geonetwork.recordsRequest({
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
