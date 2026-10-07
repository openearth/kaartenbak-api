import { datocmsRequest } from './datocms'
import https from 'https'
import { format as formatInspireMetadataXml } from './format-inspire-metadata-xml'
import { format as formatFactsheetXml } from './format-factsheet-xml'
import { fetchLayerInfo } from './fetch-layer-info'

const query = /* graphql */ `
query LayerById($id: ItemId) {
  viewerLayer(filter: {layer: {eq: $id}}) {
    useFactsheetAsMetadata
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
    layer {
      name
      description
      url
      layer
      indexableWfsProperties
    }
  }
}
`

export async function fetchLayerXML({ id }) {
  const { viewerLayer: {
    layer,
    ...viewerLayer
  } } = await datocmsRequest({ query, variables: { id } })

  const data = {
    layer: {
      ...layer,
      ...viewerLayer,
    }
  }

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })

  const layerInfo = await fetchLayerInfo(data.layer.url, data.layer.layer, httpsAgent)

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
