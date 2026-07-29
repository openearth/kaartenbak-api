import { datocmsRequest } from './datocms'
import https from 'https'
import { format as formatInspireMetadataXml } from './format-inspire-metadata-xml'
import { format as formatFactsheetXml } from './format-factsheet-xml'
import { transform } from './xml-transformer.js'
import { fetchExternalMetadataXml } from './external-metadata-utils.js'
import fetch from 'node-fetch'
import convert from 'xml-js'

const query = /* graphql */ `
query LayerById($id: ItemId) {
  viewerLayer(filter: {id: {eq: $id}}) {
    id
    useFactsheetAsMetadata
    externalMetadata
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
      url
      layer
      indexableWfsProperties
      thumbnails {
        url
      }
    }
  }
}
`

function recursivelyFindLayer(layers, name) {
  const layerList = Array.isArray(layers)
    ? layers
    : [layers]

  for (let layer of layerList) {
    if (layer.Name && layer.Name._text === name) {
      return layer
    }

    if (layer.Layer) {
      const foundLayer = recursivelyFindLayer(layer.Layer, name)
      if (foundLayer) {
        return foundLayer
      }
    }
  }

  return null
}

async function fetchLayerInfo(wmsUrl, layerName, httpsAgent) {
  const capabilitiesXml = await fetch(`${wmsUrl}?service=WMS&request=GetCapabilities`, {
    agent: httpsAgent,
  }).then((res) => res.text())

  const capabilities = JSON.parse(convert.xml2json(capabilitiesXml, { compact: true }))

  // Support both WMS 1.3.0 (WMS_Capabilities) and WMS 1.1.1 (WMT_MS_Capabilities)
  const root = capabilities.WMS_Capabilities || capabilities.WMT_MS_Capabilities
  if (!root) return null

  return recursivelyFindLayer(root.Capability.Layer, layerName)
}

export async function fetchViewerLayerXML({ id }) {
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

  let formatted = null
  let metadataType = null

  if (data.layer.useFactsheetAsMetadata) {
    const factsheet = data.layer.factsheets[0]

    if (factsheet) {
      const layerInfo = await fetchLayerInfo(data.layer.url, data.layer.layer, httpsAgent)
      formatted = formatFactsheetXml({
        id,
        layerInfo,
        layer: data.layer,
        factsheet,
      })
      metadataType = 'factsheet'
    }

  } else if (data.layer.inspireMetadata) {
    const layerInfo = await fetchLayerInfo(data.layer.url, data.layer.layer, httpsAgent)
    formatted = formatInspireMetadataXml({
      id,
      layerInfo,
      layer: data.layer,
    })
    metadataType = 'inspire'
  }
  else if (data.layer.externalMetadata) {
    // Use the shared utility function
    const xml = await fetchExternalMetadataXml(data.layer.externalMetadata);

    // Prepare thumbnails in the format expected by transform
    const thumbnails = data.layer.layer?.thumbnails?.map((thumbnail) => ({
      url: thumbnail.url,
      filename: `Kaarttitel: ${data.layer.name || data.layer.layer?.name || 'Layer'}`,
    })) || []

    // Transform the XML: add thumbnails, links, and replace ID
    formatted = transform(xml)
      .addThumbnails(thumbnails)
      .addLinks(data.layer.links || [])
      .replaceId(id)
      .getXml()
    metadataType = 'external'
  }

  return formatted ? { xml: formatted, metadataType } : null
}
