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
      	electronicmailaddress
      	role
      	organisationname
        abstract
        identificationinfoStatus
        topiccategories {
          topicCategoryItem
        }
        descriptivekeywordsKeywords {
          title
        }
      	resourceconstraintsAccessconstraints
        resourceconstraintsUseconstraints
      	mdSpatialrepresentationtypecode
      	thesaurusname
      	thesaurusdatum
      	thesaurusdatumType
        resourceconstraintsUseconstraints
        hierarchylevel
        lineageStatement
        metadatastandardname
      	metadatastandardversion
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

function recursivelyFindLayer(layers, name) {
  const layerList = Array.isArray(layers)
    ? layers
    : [layers]

  for(let layer of layerList) {
    if(layer.Name && layer.Name._text === name) {
      return layer
    }
    
    if(layer.Layer) {
      const foundLayer = recursivelyFindLayer(layer.Layer, name)
      if(foundLayer) { 
        return foundLayer
      }
    }
  }

  return null
}

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

  const layerInfo = recursivelyFindLayer(capabilities.WMS_Capabilities.Capability.Layer, data.layer.layer)

  let formatted = null

  if (data.layer.useFactsheetAsMetadata) {
    const factsheet = data.layer.factsheets[0]

    if(factsheet) {
      formatted = formatFactsheetXml({
        id,
        layerInfo,
        layer: data.layer,
        factsheet,
      })
    }

  } else if(data.layer.inspireMetadata) {
    formatted = formatInspireMetadataXml({
      id,
      layerInfo,
      layer: data.layer,
    })
  }

  return formatted
}
