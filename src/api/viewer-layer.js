import convert from 'xml-js'
import { withServerDefaults } from '../lib/with-server-defaults'
import { contentTypes } from '../lib/constants'
import { fetchViewerLayerXML } from '../lib/fetch-viewer-layer-xml'

export const handler = withServerDefaults(async (event, _) => {
  const { id, format } = event.queryStringParameters

  if (!id) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'id query parameter is required' }),
    }
  }

  if (!format) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'format query parameter is required' }),
    }
  }

  if (!['json', 'xml'].includes(format)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          'format query parameter must be one of the following values: json|xml',
      }),
    }
  }

  let formatted = await fetchViewerLayerXML({
    id,
  })

  if (format === 'json') {
    formatted = convert.xml2json(formatted, {
      compact: true,
    })
  }

  return {
    body: formatted,
    headers: {
      'content-type': contentTypes[format],
    },
  }
})
