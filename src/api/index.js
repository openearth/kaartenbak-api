import { datocmsRequest } from '../lib/datocms'
import { withServerDefaults } from '../lib/with-server-defaults'
import { formatFactsheetOverviewHTML } from '../lib/format-factsheets-overview-html'

const query = /* graphql */ `
query Factsheets {
  allFactsheets {
    id
    title
  }
}
`

export const handler = withServerDefaults(async (_, __) => {
  const data = await datocmsRequest({ query })

  const html = formatFactsheetOverviewHTML(data.allFactsheets)

  return {
    body: html,
    headers: {
      'content-type': 'text/html',
    },
  }
})
