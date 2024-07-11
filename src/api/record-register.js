import { datocmsRequest } from '../lib/datocms'
import { withServerDefaults } from '../lib/with-server-defaults'
import { Geonetwork } from '../lib/geonetwork'
import { resourceNotFound } from '../lib/constants'
import { buildMenuTree } from '../lib/build-menu-tree'
import { formatMenusRecursive } from '../lib/format-menu'
import { findGeonetworkInstances } from '../lib/find-geonetwork-instances'

const geonetworkUrl = 'geonetwork/srv'

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0, $locale: SiteLocale = nl) {
  menus: allMenus(first: $first, skip: $skip, locale: $locale) {
    id
    name
    geonetwork {
      baseUrl
      username
      password
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

export const handler = withServerDefaults(async (event, _) => {
  const { record: recordId, viewer } = event.queryStringParameters

  if (!recordId) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'record query parameter is required' }),
    }
  }

  if (!viewer) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'viewer query parameter is required' }),
    }
  }

  const { menus } = await datocmsRequest({ query: viewersWithLayersQuery })
  const formattedMenus = formatMenusRecursive(menus)

  const menuTree = buildMenuTree(formattedMenus)

  const menu = menuTree.find((menu) => menu.name === viewer)

  if (!menu) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'viewer not found' }),
    }
  }

  const geonetworkInstanceMap = findGeonetworkInstances([menu], recordId)

  const geonetworkInstance = Array.from(geonetworkInstanceMap)?.[0]?.[1]

  if (!geonetworkInstance) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'No geonetwork register found for this record' }),
    }
  }

  const { baseUrl, username, password } = geonetworkInstance

  const geonetwork = new Geonetwork(
    baseUrl + geonetworkUrl + '/api',
    username,
    password
  )

  const record = await geonetwork.recordsRequest({
    url: `/${recordId}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (record?.code === resourceNotFound) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Record does not exist' }),
    }
  }

  return {
    body: baseUrl + geonetworkUrl + '/dut/catalog.search#/metadata/' + recordId,
  }
})
