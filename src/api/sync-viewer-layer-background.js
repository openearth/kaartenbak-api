import { Geonetwork } from '../lib/geonetwork'
import { datocmsRequest } from '../lib/datocms'
import { addThumbnailsToRecord } from '../lib/add-thumbnails-to-record'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildMenuTree } from '../lib/build-menu-tree'
import { findGeonetworkInstances } from '../lib/find-geonetwork-instances'
import { fetchViewerLayerXML } from '../lib/fetch-viewer-layer-xml'
import { formatMenusRecursive } from '../lib/format-menu'
import Mailjet from 'node-mailjet'
import fs from 'fs';

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

export const handler = withServerDefaults(async (event, _) => {
  /* Protect this endpoint by using a token */
  if (process.env.SYNC_LAYER_API_TOKEN !== event.headers['x-api-key']) {
    return {
      statusCode: 401,
    }
  }

  const data = JSON.parse(event.body)

  const id = data.entity.id

  const { menus } = await datocmsRequest({
    query: viewersWithViewerLayersQuery,
    preview: true
  })
  const formattedMenus = formatMenusRecursive(menus)
  const menuTree = buildMenuTree(formattedMenus)

  try {
    const type = data.related_entities.find(entity => entity.type === 'item_type').attributes.api_key

    if (type === 'viewer_layer') {
      await syncViewerLayers(menuTree, data.event_type, id)
    } else if (type === 'menu') {
      await syncViewer(menuTree, data.event_type, id)
    }
  }
  catch (e) {
    console.log('The following error occured', e.message)

    for (let email of findEmailContactsForId(menuTree, id)) {
      console.log('Sending email to', email)

      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_FROM_EMAIL,
            },
            To: [
              {
                Email: email,
              },
            ],
            Subject: `Fout bij opslaan metadata voor laag ${layerId}`,
            HTMLPart: e.message,
          },
        ],
      })
    }
  }
})

async function syncViewer(menuTree, eventType, viewerId) {
  const viewerLayers = new Set()

  const findChilrenInMenu = (menu, viewerId) => {
    const { children } = menu

    if (children) {
      children.forEach((child) => {
        if (child.id === viewerId && child.children) {
          child.children.forEach((viewerLayer) => {
            viewerLayers.add(viewerLayer.id)
          })
        }

        findChilrenInMenu(child, viewerId)
      })
    }
  }

  menuTree.forEach((viewer) => {
    findChilrenInMenu(viewer, viewerId)
  })

  const viewerLayersArray = Array.from(viewerLayers)


  const requestsPromises = viewerLayersArray.map(
    async (viewerLayerId) => {
      await syncViewerLayers(menuTree, eventType, viewerLayerId)
    }
  )

  const results = await Promise.allSettled(requestsPromises)
}

async function syncViewerLayers(menuTree, eventType, viewerLayerId) {
  const geonetworkInstances = findGeonetworkInstances(menuTree, viewerLayerId)

  const geonetworkInstancesArray = Array.from(geonetworkInstances)

  const xml = await fetchViewerLayerXML({ id: viewerLayerId })

  // Can occur when no update needs to be done (because there is no factsheet or inspireMetadata)
  if (xml === null) {
    return
  }

  const requestsPromises = geonetworkInstancesArray.map(
    async ([_, geonetworkInstance]) => {
      const { baseUrl, username, password } = geonetworkInstance

      const geonetwork = new Geonetwork(
        baseUrl + 'geonetwork/srv/api',
        username,
        password
      )

      switch (eventType) {
        case 'create': {
          await geonetwork.recordsRequest({
            url: '?publishToAll=true',
            method: 'PUT',
            headers: {
              'Content-Type': 'application/xml',
            },
            body: xml,
          })

          break
        }

        case 'update':
        case 'publish': {
          await geonetwork.recordsRequest({
            url: '?uuidProcessing=OVERWRITE&publishToAll=true',
            method: 'PUT',
            headers: {
              'Content-Type': 'application/xml',
            },
            body: xml,
          })

          break
        }
      }

      switch (eventType) {
        case 'create':
        case 'update':
        case 'publish':
          const { viewerLayer } = await datocmsRequest({
            query: viewerLayerByIdQuery,
            variables: { id: viewerLayerId },
          })

          await addThumbnailsToRecord(viewerLayer?.layer?.thumbnails, viewerLayerId, geonetwork)
      }
    }
  )

  const results = await Promise.allSettled(requestsPromises)

  const errors = results.filter(result => result.status === 'rejected')

  if (errors.length) {
    const errorMessage = `<ul>${errors.map(error => `<li>${error.reason}</li>`).join('')}</ul>`
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
