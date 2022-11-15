const { datocmsRequest } = require('../lib/datocms')
const { withServerDefaults } = require('../lib/with-server-defaults')
const {
  formatFactsheetOverviewHTML,
} = require('../lib/format-factsheets-overview-html')

const query = /* graphql */ `
query Factsheets {
  allFactsheets {
    id
    title
  }
}
`

exports.handler = withServerDefaults(async (_, __) => {
  const data = await datocmsRequest({ query })

  const html = formatFactsheetOverviewHTML(data.allFactsheets)

  return {
    body: html,
    headers: {
      'content-type': 'text/html',
    },
  }
})
