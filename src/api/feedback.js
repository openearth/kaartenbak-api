import { datocmsRequest } from '../lib/datocms'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildMenuTree } from '../lib/build-menu-tree'
import * as EmailValidator from 'email-validator'
import Mailjet from 'node-mailjet'

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_TOKEN,
  apiSecret: process.env.MAILJET_API_SECRET,
})

const feedbackContactFragment = `
  fragment FeedbackContact on ContactRecord {
    email
  }
`

const viewersWithLayersQuery = /* graphql */ `
${feedbackContactFragment}

query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    name
    feedbackContacts {
      ...FeedbackContact
    }
    children: layers {
      id
      name
      feedbackContacts {
        ...FeedbackContact
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

function findMenuOrLayer(viewer, menuOrLayerId) {
  let menuOrLayer

  const findInMenu = (menus) => {
    for (const menu of menus) {
      const { id, children } = menu

      if (id === menuOrLayerId) {
        menuOrLayer = menu
        return
      }

      if (children) {
        findInMenu(children)
      }
    }
  }

  findInMenu([viewer])

  return menuOrLayer
}

export const handler = withServerDefaults(async (event, _) => {
  const {
    viewer: viewerName,
    menuOrLayerId,
    name,
    email,
    feedback,
    shareUrl,
  } = JSON.parse(event.body)

  if (!viewerName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'field viewer is required' }),
    }
  }

  if (!menuOrLayerId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'field menuOrLayerId is required' }),
    }
  }

  if (!name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'field name is required' }),
    }
  }

  if (!email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'field email is required' }),
    }
  }

  if (!EmailValidator.validate(email)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'email is not valid' }),
    }
  }

  if (!feedback) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'field feedback is required' }),
    }
  }

  const { menus } = await datocmsRequest({ query: viewersWithLayersQuery })

  const menuTree = buildMenuTree(menus)

  const viewer = menuTree.find((viewer) => viewer.name === viewerName)

  if (!viewer) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'viewer not found' }),
    }
  }

  let { feedbackContacts } = viewer
  const menuOrLayer = findMenuOrLayer(viewer, menuOrLayerId)

  if (!menuOrLayer) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'menu or layer not found' }),
    }
  }

  if (!feedbackContacts?.length) {
    feedbackContacts = menuOrLayer.feedbackContacts

    if (!feedbackContacts?.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'feedback contacts not found' }),
      }
    }
  }

  for (const contact of feedbackContacts) {
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
          Subject: 'Feedback',
          HTMLPart: `<p>Feedback van ${name}</p><p>Email: ${email}</p><p>Betreft de viewer/menu/folder/layer: <a href="${shareUrl}">${menuOrLayer.name}</a></p><p>Feedback:</p><p>${feedback}</p>`,
        },
      ],
    })
  }
})
