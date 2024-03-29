import { datocmsRequest } from '../lib/datocms'
import { format as formatHtml } from '../lib/format-html'
import { withServerDefaults } from '../lib/with-server-defaults'
import { contentTypes } from '../lib/constants'

const query = /* graphql */ `
query FactsheetById($id: ItemId) {
  factsheet(filter: {id: {eq: $id}}) {
    _updatedAt
    id
    title
    titelNaamMeetMonitorprogramma
    urlOriginalFile
    naamAansturendeOrganisatie
    datumVoltooiing
    samenvatting
    doelWaarvoorDataWordenVerzameld
    naamUitvoerendeDienstOrganisatie
    rolContactpersoon
    geografischGebied
    gebruiksbeperkingen
    overigeBeperkingenInGebruik
    themas {
      title
    }
    temporeleDekking
    volledigheid
    nauwkeurigheid
    algemeneBeschrijvingVanHerkomst
    inwinningsmethode
    beschrijvingUitgevoerdeBewerkingen
    meetvariabelen
    meetmethodiek
    soortDataset
    verplichtingVanuitEuropeseRichtlijn
    kostenOpJaarbasis
    soortenoverzicht
    habitats
    referenties
  }
}
`

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

  if (!['json', 'html'].includes(format)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          'format query parameter must be one of the following values: json|html',
      }),
    }
  }

  const data = await datocmsRequest({ query, variables: { id } })

  let formatted

  switch (format) {
    case 'html':
      formatted = formatHtml(data.factsheet)
      break
    case 'json':
      formatted = JSON.stringify(data.factsheet)
      break
  }

  return {
    body: formatted,
    headers: {
      'content-type': contentTypes[format],
    },
  }
})
