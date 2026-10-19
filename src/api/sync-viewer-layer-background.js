import { Geonetwork } from '../lib/geonetwork'
import { datocmsRequest } from '../lib/datocms'
import { addThumbnailsToRecord } from '../lib/add-thumbnails-to-record'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildMenuTree } from '../lib/build-menu-tree'
import { findGeonetworkInstances } from '../lib/find-geonetwork-instances'
import { fetchViewerLayerXML } from '../lib/fetch-viewer-layer-xml'
import { formatMenusRecursive } from '../lib/format-menu'
import Mailjet from 'node-mailjet'

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_TOKEN,
  apiSecret: process.env.MAILJET_API_SECRET,
})

const viewersWithViewerLayersQuery = /* graphql */ `
query viewersWithViewerLayersQuery ($first: IntType, $skip: IntType = 0, $locale: SiteLocale = nl) {
  menus: allMenus(first: $first, skip: $skip, locale: $locale) {
    id
    geonetwork {
      baseUrl
      username
      password
    }
    errorNotificationContacts {
      email
    }
    children: viewerLayers {
      id
    }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}`

const viewerLayerByIdQuery = /* graphql */ `
query LayerById($id: ItemId) {
  viewerLayer(filter: {id: {eq: $id}}) {
    layer {
      id
      thumbnails {
        filename
        url
      } 
    }
  }
}`

const viewerLayersByInspireDatasetIdQuery = /* graphql */ `
query ViewerLayersByInspireDatasetId($id: ItemId, $first: IntType, $skip: IntType = 0) {
  viewerLayers: allViewerLayers(
    filter: {inspireMetadata: {eq: $id}}
    first: $first
    skip: $skip
  ) {
    id
  }
  _allViewerLayersMeta(filter: {inspireMetadata: {eq: $id}}) {
    count
  }
}`

const viewerLayersByLayerIdQuery = /* graphql */ `
query ViewerLayersByLayerId($id: ItemId, $first: IntType, $skip: IntType = 0) {
  viewerLayers: allViewerLayers(
    filter: {layer: {eq: $id}}
    first: $first
    skip: $skip
  ) {
    id
  }
  _allViewerLayersMeta(filter: {layer: {eq: $id}}) {
    count
  }
}`

function getRequestId(event) {
  return event.headers?.['x-nf-request-id'] || event.headers?.['X-Nf-Request-Id'] || 'unknown'
}

function getHeader(event, name) {
  return event.headers?.[name.toLowerCase()] || event.headers?.[name]
}

export const handler = withServerDefaults(async (event, _) => {
  const reqId = getRequestId(event)
  const startedAt = Date.now()
  const outcomes = []

  const incomingKey = getHeader(event, 'x-api-key')
  if (process.env.SYNC_LAYER_API_TOKEN !== incomingKey) {
    console.warn('[LOG] Unauthorized', { reqId, hasKey: Boolean(incomingKey) })
    return { statusCode: 401 }
  }

  let data
  try {
    data = JSON.parse(event.body)
  } catch (e) {
    console.error('[LOG] Invalid JSON body', { reqId, err: e.message })
    return { statusCode: 400 }
  }

  const id = data?.entity?.id
  const eventType = data?.event_type
  let status = 'completed'
  let type

  let menuTree = null
  const notificationIds = new Set(id ? [id] : [])
  try {
    const itemTypeEntity = data?.related_entities?.find((entity) => entity?.type === 'item_type')
    type = itemTypeEntity?.attributes?.api_key
    if (!type) {
      throw new Error('No item_type.api_key found in related_entities')
    }
    if (!['create', 'update', 'publish'].includes(eventType)) {
      status = 'ignored'
      outcomes.push({ status: 'skipped', reason: 'Unsupported sync event' })
      return { statusCode: 202 }
    }

    const { menus } = await datocmsRequest({
      query: viewersWithViewerLayersQuery,
    })

    const formattedMenus = formatMenusRecursive(menus)
    menuTree = buildMenuTree(formattedMenus)

    if (type === 'viewer_layer') {
      await syncViewerLayers(menuTree, eventType, id, outcomes)
    } else if (type === 'menu') {
      await syncViewer(menuTree, eventType, id, outcomes)
    } else if (type === 'inspire_dataset') {
      await syncLinkedViewerLayers(
        menuTree,
        eventType,
        id,
        viewerLayersByInspireDatasetIdQuery,
        'INSPIRE dataset',
        notificationIds,
        outcomes
      )
    } else if (type === 'layer') {
      await syncLinkedViewerLayers(
        menuTree,
        eventType,
        id,
        viewerLayersByLayerIdQuery,
        'layer',
        notificationIds,
        outcomes
      )
    } else {
      status = 'ignored'
    }
  } catch (e) {
    status = 'failed'
    console.error('[LOG] Error', { reqId, id, eventType, err: e.message })

    if (menuTree && id) {
      const emailContacts = new Set(
        [...notificationIds].flatMap((notificationId) =>
          [...findEmailContactsForId(menuTree, notificationId)]
        )
      )
      for (const email of emailContacts) {
        try {
          await mailjet.post('send', { version: 'v3.1' }).request({
            Messages: [
              {
                From: { Email: process.env.MAILJET_FROM_EMAIL },
                To: [{ Email: email }],
                Subject: `Fout bij opslaan metadata voor laag ${id}`,
                HTMLPart: e.message,
              },
            ],
          })
        } catch (emailError) {
          console.error('[LOG] Failed to send email', { reqId, email, err: emailError.message })
        }
      }
    }
  } finally {
    if (status === 'completed' && outcomes.some((outcome) => outcome.xml === 'unknown (no processing report)')) {
      status = 'unconfirmed'
    }
    console.log('[LOG] Sync finished', {
      reqId, id, type, eventType, status,
      durationMs: Date.now() - startedAt,
      outcomes,
    })
  }

  return { statusCode: 202 }
})

async function syncViewer(menuTree, eventType, viewerId, outcomes) {
  const viewerLayers = new Set()

  const findChildrenInMenu = (menu, targetViewerId) => {
    const { children } = menu

    if (children) {
      children.forEach((child) => {
        if (child.id === targetViewerId && child.children) {
          child.children.forEach((viewerLayer) => {
            viewerLayers.add(viewerLayer.id)
          })
        }
        findChildrenInMenu(child, targetViewerId)
      })
    }
  }

  menuTree.forEach((viewer) => {
    findChildrenInMenu(viewer, viewerId)
  })

  const viewerLayersArray = Array.from(viewerLayers)
  if (viewerLayersArray.length === 0) {
    outcomes.push({ status: 'skipped', reason: 'No viewer layers found in menu' })
  }
  const requestsPromises = viewerLayersArray.map((viewerLayerId) =>
    syncViewerLayers(menuTree, eventType, viewerLayerId, outcomes)
  )

  const results = await Promise.allSettled(requestsPromises)
  throwSyncErrors(results)
}

async function syncLinkedViewerLayers(menuTree, eventType, itemId, query, itemType, notificationIds, outcomes) {
  const { viewerLayers } = await datocmsRequest({
    query,
    variables: { id: itemId },
  })

  const viewerLayerIds = viewerLayers.map(({ id: viewerLayerId }) => viewerLayerId)
  viewerLayerIds.forEach((viewerLayerId) => notificationIds.add(viewerLayerId))

  if (viewerLayers.length === 0) {
    outcomes.push({ status: 'skipped', reason: `No viewer layers linked to ${itemType}` })
    return
  }

  const results = await Promise.allSettled(
    viewerLayerIds.map((viewerLayerId) =>
      syncViewerLayers(menuTree, eventType, viewerLayerId, outcomes)
    )
  )
  throwSyncErrors(results)
}

function throwSyncErrors(results) {
  const errors = results.filter((result) => result.status === 'rejected')
  if (errors.length) {
    const errorMessage = `<ul>${errors.map((error) => `<li>${error.reason}</li>`).join('')}</ul>`
    throw new Error(errorMessage)
  }
}

async function syncViewerLayers(menuTree, eventType, viewerLayerId, outcomes) {
  const initialOutcomeCount = outcomes.length
  try {
    await syncViewerLayerDestinations(menuTree, eventType, viewerLayerId, outcomes)
  } catch (error) {
    if (!outcomes.slice(initialOutcomeCount).some((outcome) =>
      outcome.viewerLayerId === viewerLayerId && outcome.status === 'failed')) {
      outcomes.push({ viewerLayerId, status: 'failed', step: 'prepare metadata', error: error.message })
    }
    throw error
  }
}

async function syncViewerLayerDestinations(menuTree, eventType, viewerLayerId, outcomes) {
  const geonetworkInstances = findGeonetworkInstances(menuTree, viewerLayerId)
  const geonetworkInstancesArray = Array.from(geonetworkInstances)

  if (geonetworkInstancesArray.length === 0) {
    outcomes.push({ viewerLayerId, status: 'skipped', reason: 'No GeoNetwork instances found' })
    return
  }

  const result = await fetchViewerLayerXML({ id: viewerLayerId })

  if (result === null) {
    outcomes.push({ viewerLayerId, status: 'skipped', reason: 'No metadata XML available' })
    return
  }

  const { xml, metadataType, layerTitle } = result
  
  // Fetch layerId once (shared across all GeoNetwork instances for this viewer layer)
  const { viewerLayer } = await datocmsRequest({
    query: viewerLayerByIdQuery,
    variables: { id: viewerLayerId },
  })
  const layerId = viewerLayer?.layer?.id

  const requestsPromises = geonetworkInstancesArray.map(async ([_, geonetworkInstance]) => {
    const { baseUrl, username, password } = geonetworkInstance
    const geonetworkUrl = `${baseUrl}geonetwork/srv/api`
    const geonetwork = new Geonetwork(geonetworkUrl, username, password)

    const outcome = { viewerLayerId, layerTitle, baseUrl, metadataType, xml: 'not uploaded', thumbnails: 'not synced' }
    let step = 'check existing records'
    try {
      const viewerLayerExists = await geonetwork.recordExists(viewerLayerId)
      const layerExists = layerId ? await geonetwork.recordExists(layerId) : false

      const action = viewerLayerExists ? 'updated' : layerExists ? 'migrated from layerId' : 'created'
      step = 'upload XML'
      outcome.xml = await syncRecordToGeoNetwork(geonetwork, eventType, xml)

      // Remove legacy layerId record to prevent duplicates
      if (layerExists) {
        step = 'delete legacy record'
        await geonetwork.deleteRecord(layerId)
      }

      step = 'sync thumbnails'
      await syncThumbnails(geonetwork, eventType, viewerLayerId)
      outcome.thumbnails = 'synced'
      outcome.status = outcome.xml === 'uploaded' ? 'completed' : 'unconfirmed'
      outcome.action = action
    } catch (error) {
      outcome.status = 'failed'
      outcome.step = step
      outcome.error = error.message
      throw error
    } finally {
      outcomes.push(outcome)
    }
  })

  const results = await Promise.allSettled(requestsPromises)
  throwSyncErrors(results)
}

function findEmailContactsForId(menuTree, id) {
  const contacts = new Set()
  menuTree.forEach((viewer) => {
    const findInMenu = (menu) => {
      const { children } = menu

      if (children) {
        children.forEach((child) => {
          if (child.id === id) {
            const { errorNotificationContacts } = viewer

            if (errorNotificationContacts.length) {
              for (let { email } of errorNotificationContacts) {
                contacts.add(email)
              }
            }
          }
          findInMenu(child)
        })
      }
    }
    findInMenu(viewer)
  })
  return contacts
}

async function syncRecordToGeoNetwork(geonetwork, eventType, xml) {
  switch (eventType) {
    case 'create': {
      const report = await geonetwork.recordsRequest({
        url: '?publishToAll=true',
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      })
      return checkGeonetworkUploadReport(report)
    }

    case 'update':
    case 'publish': {
      const report = await geonetwork.recordsRequest({
        url: '?uuidProcessing=OVERWRITE&publishToAll=true',
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      })
      return checkGeonetworkUploadReport(report)
    }
  }
}

// GeoNetwork can answer HTTP 200 while its processing report says the record was not stored.
function checkGeonetworkUploadReport(report) {
  const processed = report?.numberOfRecordsProcessed
  const withErrors = report?.numberOfRecordsWithErrors
  const errors = Array.isArray(report?.errors) ? report.errors : []
  if (typeof processed !== 'number') {
    return 'unknown (no processing report)'
  } else if (processed > 0 && !withErrors && !errors.length) {
    return 'uploaded'
  } else {
    throw new Error(`GeoNetwork upload failed: ${JSON.stringify({
      processed, withErrors, errors: errors.map((error) => error?.message || JSON.stringify(error)),
    })}`)
  }
}

async function syncThumbnails(geonetwork, eventType, viewerLayerId) {
  if (eventType !== 'create' && eventType !== 'update' && eventType !== 'publish') {
    return
  }

  const { viewerLayer } = await datocmsRequest({
    query: viewerLayerByIdQuery,
    variables: { id: viewerLayerId },
  })

  await addThumbnailsToRecord(viewerLayer?.layer?.thumbnails, viewerLayerId, geonetwork, { logSuccess: false })
}
