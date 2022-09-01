const { datocmsRequest } = require('../lib/datocms')
const { format: formatXml } = require('../lib/factsheet/format-xml')
const { format: formatHtml } = require('../lib/factsheet/format-html')
const convert = require('xml-js')

const query = /* graphql */ `
query FactsheetById($id: ItemId) {
  factsheet(filter: {id: {eq: $id}}) {
    _updatedAt
    id
    title
    urlOriginalFile
    naamAansturendeOrganisatie
    datumVoltooiing
    doelWaarvoorDataWordenVerzameld
    naamUitvoerendeDienstOrganisatie
    rolContactpersoon
    geografischGebied
    gebruiksbeperkingen
    overigeBeperkingenInGebruik
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
    metadata {
      citationTitle
      citationDateDate
      citationDateDatetype
      abstract
      identificationinfoStatus
      topiccategories {
          title
      }
      descriptivekeywordsKeywords {
        title
      }
      resourceconstraintsUselimitation
      resourceconstraintsAccessconstraints
      spatialresolutionEquivalentscaleDenominator
      referencesystemidentifierCode
      hierarchylevel
      lineageStatement
    }

  }
}
`

const contentType = {
  xml: 'application/xml',
  html: 'text/html',
  json: 'application/json',
}

exports.handler = async (event, context) => {
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

  if (!['json', 'xml', 'html'].includes(format)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          'format query parameter must be one of the following values: json|xml|html',
      }),
    }
  }

  try {
    const data = await datocmsRequest({ query, variables: { id } })

    const factsheetId = 'factsheet-' + id

    let formatted

    switch (format) {
      case 'xml':
        formatted = formatXml({ id: factsheetId, item: data.factsheet })
        break
      case 'html':
        formatted = formatHtml(data.factsheet)
        break
      case 'json':
        formatted = convert.xml2json(
          formatXml({ id: factsheetId, item: data.factsheet }),
          {
            compact: true,
          }
        )
        break
    }

    return {
      statusCode: 200,
      body: formatted,
      headers: {
        'content-type': contentType[format],
        'Access-Control-Allow-Origin': '*',
      },
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed fetching data' }),
    }
  }
}
