import FormData from 'form-data'
import fetch from 'node-fetch'

export async function addThumbnailsToRecord(thumbnails, recordId, geonetwork) {
  if (!thumbnails || thumbnails.length === 0) {
    return
  }

  const forms = await Promise.all(
    thumbnails.map(async (thumbnail) => {
      const blob = await fetch(thumbnail.url).then((res) => res.blob())
      const arrayBuffer = await blob.arrayBuffer()
      const form = new FormData()
      form.append('file', Buffer.from(arrayBuffer), thumbnail.filename)

      return form
    })
  )

  let attachments = []
  try {
    attachments = await geonetwork.recordsRequest({
      url: `/${recordId}/attachments`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
  catch(e) {
    if(e.code !== 'resource_not_found') {
      throw e
    }
  }

  for (const attachment of attachments) {
    try {
      await geonetwork.recordsRequest({
        url: `/${attachment.metadataId}/processes/thumbnail-remove?thumbnail_url=${attachment.url}&process=thumbnail-remove&id=${attachment.metadataId}`,
        method: 'POST',
        headers: {
          accept: 'application/xml',
          'Content-Type': 'application/json',
        },
        options: {
          responseText: true,
        },
      })
    } catch (error) {
      // Ignore errors when removing thumbnails - they might not exist
      console.warn('[THUMBNAIL] Failed to remove thumbnail:', error.message)
    }
  }

  if(attachments.length > 0) {
    try {
      await geonetwork.recordsRequest({
        url: `/${recordId}/attachments`,
        method: 'DELETE',
        options: {
          responseText: true,
        },
      })
    } catch (error) {
      // Ignore delete errors - attachments might already be gone
      console.warn('[THUMBNAIL] Failed to delete attachments:', error.message)
    }
  }

  for (const form of forms) {
    try {
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
    } catch (error) {
      // If resource already exists, that's okay - it means the thumbnail is already there
      if (error.code === 'resource_already_exist' || error.message?.includes('Resource already exists')) {
        console.log('[THUMBNAIL] Attachment already exists, skipping:', recordId)
        continue
      }
      // Re-throw other errors
      throw error
    }
  }
}
