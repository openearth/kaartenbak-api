import { datocmsRequest } from '../lib/datocms'
import { withServerDefaults } from '../lib/with-server-defaults'
import { buildMenuTree } from '../lib/build-menu-tree'
import * as EmailValidator from 'email-validator'

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    name
    children: layers {
      id
      name
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

  let { feedbackContact } = viewer;

  if (!feedbackContact) {
    const menuOrLayer = findMenuOrLayer(viewer, menuOrLayerId)

    if (!menuOrLayer) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'menu or layer not found' }),
      }
    }

    feedbackContact = menuOrLayer.feedbackContact

    if (!feedbackContact) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'feedback contact not found' }),
      }
    }
  }

  console.log(feedbackContact)
})
