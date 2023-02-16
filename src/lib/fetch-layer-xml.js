const { datocmsRequest } = require('./datocms')
const https = require('https')
const {
  format: formatInspireMetadataXml,
} = require('./format-inspire-metadata-xml')
const { format: formatFactsheetXml } = require('./format-factsheet-xml')
const fetch = require('node-fetch')
const convert = require('xml-js')

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
          topicCategoryItem
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
        topicCategoryItem
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
    links {
      protocol
      url
      name
      description
    }
    pointOfContactOrganisations {
      organisationName
      email
      rol
    }
  }
}
`

async function fetchLayerXML({
  id,
}) {
  console.log("before datocmsRequest")

  console.log(id)

  const data = await datocmsRequest({ query, variables: { id } })

  console.log("after datocmsRequest")

  const getCapabilitiesUrl = `${data.layer.url}?service=WMS&request=GetCapabilities`

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })

  const capabilitiesXml = await fetch(getCapabilitiesUrl, {
    agent: httpsAgent,
  }).then((res) => res.text())

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
      factsheet,
    })
  } else {
    formatted = formatInspireMetadataXml({
      id,
      layerInfo,
      layer: data.layer,
    })
  }

  return formatted
}

module.exports = {
  fetchLayerXML,
}
