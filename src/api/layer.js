const convert = require('xml-js')
const { withServerDefaults } = require('../lib/with-server-defaults')
const { contentTypes } = require('../lib/constants')
const { fetchLayerXML } = require('../lib/fetch-layer-xml')

exports.handler = withServerDefaults(async (event, _) => {
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

  let formatted = await fetchLayerXML({
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
