const { datocmsRequest } = require('../lib/datocms')
const {
  format: formatInspireMetadataXml,
} = require('../lib/format-inspire-metadata-xml')
const { format: formatFactsheetXml } = require('../lib/format-factsheet-xml')
const convert = require('xml-js')
const fetch = require('node-fetch')
const { withServerDefaults } = require('../lib/with-server-defaults')
const { contentTypes } = require('../lib/constants')
const { formatKeywords } = require('../lib/format-keywords')

const query = /* graphql */ `
query LayerById($id: ItemId) {
  layer(filter: {id: {eq: $id}}) {
    name
    url
    layer
    useFactsheetAsMetadata
    indexableWfsProperties
    inspireMetadata {
        _updatedAt
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
    factsheets {
      _updatedAt
      id
      title
      titelNaamMeetMonitorprogramma
      urlOriginalFile
      naamAansturendeOrganisatie
      datumVoltooiing
      datumVanDeBron
      datumtypeVanDeBron
      samenvatting
      identificationinfoStatus
      doelWaarvoorDataWordenVerzameld
      onderwerp {
        title
      }
      naamUitvoerendeDienstOrganisatie
      rolContactpersoon
      geografischGebied
      toepassingsschaal
      gebruiksbeperkingen
      overigeBeperkingenInGebruik
      themas {
        title
      }
      temporeleDekking
      hierarchieniveau
      volledigheid
      nauwkeurigheid
      algemeneBeschrijvingVanHerkomst
      inwinningsmethode
      beschrijvingUitgevoerdeBewerkingen
      meetvariabelen
      meetmethodiek
      soortDataset
      kostenOpJaarbasis
      soortenoverzicht
      habitats
    }
  }
}
`

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

  let formatted
  
  if (data.layer.useFactsheetAsMetadata) {
    const factsheet = data.layer.factsheets[0]

    formatted = formatFactsheetXml({
      id,
      layerInfo,
      layer: data.layer,
      factsheet: factsheet,
    })
  } else {
    formatted = formatInspireMetadataXml({
      id,
      layerInfo,
      layer: data.layer,
    })
  }

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
