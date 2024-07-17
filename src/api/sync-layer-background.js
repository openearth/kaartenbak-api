import { Geonetwork } from '../lib/geonetwork'
import { datocmsRequest } from '../lib/datocms'
import { addThumbnailsToRecord } from '../lib/add-thumbnails-to-record'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildMenuTree } from '../lib/build-menu-tree'
import { findGeonetworkInstances } from '../lib/find-geonetwork-instances'
import { fetchLayerXML } from '../lib/fetch-layer-xml'
import { formatMenusRecursive } from '../lib/format-menu'
import Mailjet from 'node-mailjet'

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_TOKEN,
  apiSecret: process.env.MAILJET_API_SECRET,
})

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0, $locale: SiteLocale = nl) {
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
      layer {
        id
      }
    }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}`

const layerByIdQuery = /* graphql */ `
query LayerById($id: ItemId) {
  layer(filter: {id: {eq: $id}}) {
    thumbnails {
      filename
      url
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

  const layerData = JSON.parse(event.body)

  const layerId = layerData.entity.id

  const { menus } = await datocmsRequest({
    query: viewersWithLayersQuery,
  })
  const formattedMenus = formatMenusRecursive(menus)
  const menuTree = buildMenuTree(formattedMenus)

  try {
    await syncLayers(menuTree, layerData.event_type, layerId)
  }
  catch(e) {
    console.log('The following error occured', e.message)

    for(let email of findEmailContactsForLayerId(menuTree, layerId)) {
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

async function syncLayers(menuTree, eventType, layerId) {
  const geonetworkInstances = findGeonetworkInstances(menuTree, layerId)

  const geonetworkInstancesArray = Array.from(geonetworkInstances)

  const xml = await fetchLayerXML({ id: layerId })

  // Can occur when no update needs to be done (because there is no factsheet or inspireMetadata)
  if(xml === null) {
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
              'Content-Type': 'application/json',
            },
            body: xml,
          })

          break
        }

        case 'publish': {
          await geonetwork.recordsRequest({
            url: '?uuidProcessing=OVERWRITE&publishToAll=true',
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: xml,
          })

          break
        }
      }

      switch (eventType) {
        case 'create':
        case 'publish':
          const {
            layer: { thumbnails },
          } = await datocmsRequest({
            query: layerByIdQuery,
            variables: { id: layerId },
          })

          await addThumbnailsToRecord(thumbnails, layerId, geonetwork)
      }
    }
  )

  const results = await Promise.allSettled(requestsPromises)

  const errors = results.filter(result => result.status === 'rejected')

  if(errors.length) {
    const errorMessage = `<ul>${ errors.map(error => `<li>${error.reason}</li>`).join('') }</ul>`
    throw new Error(errorMessage)
  }

}

function findEmailContactsForLayerId(menuTree, layerId) {
  const contacts = new Set()

  menuTree.forEach((viewer) => {
    
    const findInMenu = (menu) => {
      const { children } = menu

      if (children) {
        children.forEach((child) => {
          
          if (child.layer.id === layerId) {
            const { errorNotificationContacts } = viewer

            if (errorNotificationContacts.length) {
              for(let {email} of errorNotificationContacts) {
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
