import { Geonetwork } from '../lib/geonetwork'
import { datocmsRequest } from '../lib/datocms'
import { addThumbnailsToRecord } from '../lib/add-thumbnails-to-record'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildMenuTree } from '../lib/build-menu-tree'
import { findGeonetworkInstances } from '../lib/find-geonetwork-instances'
import { fetchLayerXML } from '../lib/fetch-layer-xml'
import Mailjet from 'node-mailjet'

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_TOKEN,
  apiSecret: process.env.MAILJET_API_SECRET,
})

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    geonetwork {
      baseUrl
      username
      password
    }
    errorNotificationContacts {
      email
    }
    children: layers {
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

  const menuTree = buildMenuTree(menus)

  const geonetworkInstances = findGeonetworkInstances(menuTree, layerId)

  const geonetworkInstancesArray = Array.from(geonetworkInstances)

  const xml = await fetchLayerXML({ id: layerId })

  const requestsPromises = geonetworkInstancesArray.map(
    async ([_, geonetworkInstance]) => {
      const { baseUrl, username, password } = geonetworkInstance

      const geonetwork = new Geonetwork(
        baseUrl + 'geonetwork/srv/api',
        username,
        password
      )

      switch (layerData.event_type) {
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

      switch (layerData.event_type) {
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
    console.log(errors)

    const messages = errors.map(error => `<li>${error.reason}</li>`)
    const contacts = findEmailContactsForLayerId(menuTree, layerId)

    for(let contact of contacts) {
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_FROM_EMAIL,
            },
            To: [
              {
                Email: contact.email,
              },
            ],
            Subject: `Fout bij synchroniseren metadata voor laag ${layerId}`,
            HTMLPart: `<p>Er ging iets Fout bij synchroniseren metadata voor laag:</p><ul>${ messages }</ul>`,
          },
        ],
      })
    }
  }

})


export function findEmailContactsForLayerId(menuTree, layerId) {
  const contacts = new Set()

  menuTree.forEach((viewer) => {
    const findInMenu = (menu) => {
      const { children } = menu

      if (children) {
        children.forEach((child) => {
          if (child.id === layerId) {
            const { errorNotificationContacts } = viewer

            if (errorNotificationContacts.email) {
              for(let email of errorNotificationContacts.email) {
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
