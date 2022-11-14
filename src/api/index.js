const { datocmsRequest } = require('../lib/datocms')
const { withServerError } = require('../lib/with-server-error')
const { formatFactsheetOverviewHTML } = require('../lib/format-factsheets-overview-html')

const query = /* graphql */ `
query Factsheets {
  allFactsheets {
    id
    title
  }
}
`

exports.handler = withServerError(async (_, __) => {
  const data = await datocmsRequest({ query })

  const html = formatFactsheetOverviewHTML(data.allFactsheets)

  return {
    statusCode: 200,
    body: html,
    headers: {
      'content-type': 'text/html',
      'Access-Control-Allow-Origin': '*',
    },
  }
})
