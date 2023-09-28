import { datocmsRequest } from './datocms'
import https from 'https'
import { format as formatInspireMetadataXml } from './format-inspire-metadata-xml'
import { format as formatFactsheetXml } from './format-factsheet-xml'
import fetch from 'node-fetch'
import convert from 'xml-js'

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
        links {
          protocol
          url
          name
          description
        }
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

export async function fetchLayerXML({ id }) {
  const data = await datocmsRequest({ query, variables: { id } })

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

  const layers = Array.isArray(capabilities.WMS_Capabilities.Capability.Layer.Layer)
    ? capabilities.WMS_Capabilities.Capability.Layer.Layer
    : [capabilities.WMS_Capabilities.Capability.Layer.Layer]

  const layerInfo = layers.find(
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
