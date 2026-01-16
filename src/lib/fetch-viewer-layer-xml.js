import { datocmsRequest } from './datocms'
import https from 'https'
import { format as formatInspireMetadataXml } from './format-inspire-metadata-xml'
import { format as formatFactsheetXml } from './format-factsheet-xml'
import { transform } from './xml-transformer.js'
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
// Add this function before fetchViewerLayerXML
const transformSourceUrl = (sourceUrl) => {
  const url = new URL(sourceUrl)
  const baseUrl = url.origin
  const uuid = sourceUrl.split("/").pop()
  const geonetworkPath = url.pathname.split("/").slice(0, 2).join("/")

  return `${baseUrl}${geonetworkPath}/srv/api/records/${uuid}`
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

    if (factsheet) {
      formatted = formatFactsheetXml({
        id,
        layerInfo,
        layer: data.layer,
        factsheet,
      })
    }

  } else if (data.layer.inspireMetadata) {
    formatted = formatInspireMetadataXml({
      id,
      layerInfo,
      layer: data.layer,
    })
  }
  else if (data.layer.externalMetadata) {
    // Transform the source URL to API format
    const transformedSource = transformSourceUrl(data.layer.externalMetadata);
    const xmlUrl = `${transformedSource}/formatters/xml`

    // Fetch the XML from the source GeoNetwork
    const xml = await fetch(xmlUrl, {
      method: "GET",
      headers: {
        Accept: "application/xml",
        "Accept-Language": "en-US,en;q=0.5",
      },
    }).then((res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to fetch ${xmlUrl} with status ${res.status}`
        );
      }
      return res.text()
    });

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
  }

  return formatted
}
