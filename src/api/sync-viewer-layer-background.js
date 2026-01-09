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
      thumbnails {
        filename
        url
      } 
    }
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

  console.log('[SYNC] Invoked', {
    reqId,
    path: event.path,
    method: event.httpMethod,
    environment: getHeader(event, 'x-environment'),
  })

  const incomingKey = getHeader(event, 'x-api-key')
  if (process.env.SYNC_LAYER_API_TOKEN !== incomingKey) {
    console.warn('[SYNC] Unauthorized', { reqId, hasKey: Boolean(incomingKey) })
    return { statusCode: 401 }
  }

  let data
  try {
    data = JSON.parse(event.body)
  } catch (e) {
    console.error('[SYNC] Invalid JSON body', { reqId, err: e.message })
    return { statusCode: 400 }
  }

  const id = data?.entity?.id
  const eventType = data?.event_type
  console.log('[SYNC] Starting', { reqId, id, eventType })

  let menuTree = null
  try {
    const { menus } = await datocmsRequest({
      query: viewersWithViewerLayersQuery,
      preview: true,
    })

    const formattedMenus = formatMenusRecursive(menus)
    menuTree = buildMenuTree(formattedMenus)

    const itemTypeEntity = data?.related_entities?.find((entity) => entity?.type === 'item_type')
    const type = itemTypeEntity?.attributes?.api_key

    console.log('[SYNC] Webhook type resolved', { reqId, type })

    if (!type) {
      throw new Error('No item_type.api_key found in related_entities')
    }

    if (type === 'viewer_layer') {
      await syncViewerLayers(menuTree, eventType, id)
    } else if (type === 'menu') {
      await syncViewer(menuTree, eventType, id)
    } else {
      console.log('[SYNC] Ignored webhook type', { reqId, type })
    }

    console.log('[SYNC] Success', { reqId, id, eventType, type })
  } catch (e) {
    console.error('[SYNC] Error', { reqId, id, eventType, err: e.message })

    if (menuTree && id) {
      const emailContacts = findEmailContactsForId(menuTree, id)
      for (const email of emailContacts) {
        console.log('[SYNC] Sending email to', { reqId, email })
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
          console.error('[SYNC] Failed to send email', { reqId, email, err: emailError.message })
        }
      }
    }
  }

  return { statusCode: 202 }
})

async function syncViewer(menuTree, eventType, viewerId) {
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
  const requestsPromises = viewerLayersArray.map((viewerLayerId) =>
    syncViewerLayers(menuTree, eventType, viewerLayerId)
  )

  await Promise.allSettled(requestsPromises)
}

async function syncViewerLayers(menuTree, eventType, viewerLayerId) {
  const geonetworkInstances = findGeonetworkInstances(menuTree, viewerLayerId)
  const geonetworkInstancesArray = Array.from(geonetworkInstances)

  if (geonetworkInstancesArray.length === 0) {
    console.warn('[SYNC] No GeoNetwork instances found', { viewerLayerId })
    return
  }

  const xml = await fetchViewerLayerXML({ id: viewerLayerId })

  if (xml === null) {
    console.log('[SYNC] No XML returned; skipping', { viewerLayerId })
    return
  }

  const requestsPromises = geonetworkInstancesArray.map(async ([_, geonetworkInstance]) => {
    const { baseUrl, username, password } = geonetworkInstance
    const geonetworkUrl = `${baseUrl}geonetwork/srv/api`
    const geonetwork = new Geonetwork(geonetworkUrl, username, password)

    try {
      await syncRecordToGeoNetwork(geonetwork, eventType, xml, baseUrl)
      await syncThumbnails(geonetwork, eventType, viewerLayerId)
    } catch (error) {
      console.error('[SYNC] GeoNetwork error', { baseUrl, err: error.message })
      throw error
    }
  })

  const results = await Promise.allSettled(requestsPromises)
  const errors = results.filter((result) => result.status === 'rejected')

  if (errors.length) {
    const errorMessage = `<ul>${errors.map((error) => `<li>${error.reason}</li>`).join('')}</ul>`
    throw new Error(errorMessage)
  }
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

async function syncRecordToGeoNetwork(geonetwork, eventType, xml, baseUrl) {
  switch (eventType) {
    case 'create': {
      await geonetwork.recordsRequest({
        url: '?publishToAll=true',
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      })
      console.log('[SYNC] Record created in GeoNetwork', { baseUrl })
      break
    }

    case 'update':
    case 'publish': {
      await geonetwork.recordsRequest({
        url: '?uuidProcessing=OVERWRITE&publishToAll=true',
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      })
      console.log('[SYNC] Record updated in GeoNetwork', { baseUrl })
      break
    }
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

  await addThumbnailsToRecord(viewerLayer?.layer?.thumbnails, viewerLayerId, geonetwork)
}
