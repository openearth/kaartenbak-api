const { datocmsRequest } = require('../lib/datocms')
const { format: formatXml } = require('../lib/factsheet/format-xml')
const convert = require('xml-js')
const fetch = require('node-fetch')

const query = /* graphql */ `
query LayerById($id: ItemId) {
  layer(filter: {id: {eq: $id}}) {
    name
    url
    layer
    factsheets {
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
    }
    inspireMetadata {
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

  if (!['json', 'xml'].includes(format)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          'format query parameter must be one of the following values: json|xml',
      }),
    }
  }

  try {
    const data = await datocmsRequest({ query, variables: { id } })

    const getCapabilitiesUrl = `${data.layer.url}?service=WMS&request=GetCapabilities`

    const capabilitiesXml = await fetch(getCapabilitiesUrl).then((res) =>
      res.text()
    )

    const capabilities = JSON.parse(
      convert.xml2json(capabilitiesXml, {
        compact: true,
      })
    )

    const layerInfo = capabilities.WMS_Capabilities.Capability.Layer.Layer.find(
      (layer) => layer.Name._text === data.layer.layer
    )

    const factsheet = data.layer.factsheets[0]

    const layerId = 'layer-' + id

    let formatted

    switch (format) {
      case 'xml':
        formatted = formatXml({
          id: layerId,
          item: factsheet,
          layerInfo,
          layer: data.layer,
        })
        break
      case 'json':
        formatted = convert.xml2json(
          formatXml({
            id: layerId,
            item: factsheet,
            layerInfo,
            layer: data.layer,
          }),
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
