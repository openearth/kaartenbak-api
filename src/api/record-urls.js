const { datocmsRequest } = require('../lib/datocms')
const { withServerDefaults } = require('../lib/with-server-defaults')
const { Geonetwork } = require('../lib/geonetwork')
const { resourceNotFound, fulfilled } = require('../lib/constants')
const { viewersWithLayersQuery } = require('../lib/viewers-with-layers-query')
const { buildMenuTree } = require('../lib/build-menu-tree')
const { findGeonetworkInstances } = require('../lib/find-geonetwork-instances')

const geonetworkUrl = 'geonetwork/srv'

exports.handler = withServerDefaults(async (event, _) => {
  const { record: recordId } = event.queryStringParameters

  if (!recordId) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'record query parameter is required' }),
    }
  }

  const { menus } = await datocmsRequest({ query: viewersWithLayersQuery })

  const menuTree = buildMenuTree(menus)

  const geonetworkInstances = findGeonetworkInstances(menuTree, recordId)

  const geonetworkInstancesArray = Array.from(geonetworkInstances)

  const requestsPromises = geonetworkInstancesArray.map(
    async ([_, geonetworkInstance]) => {
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
        throw new Error(record?.message)
      }

      return baseUrl + geonetworkUrl + '/dut/catalog.search#/metadata/' + recordId
    }
  )

  const results = await Promise.allSettled(requestsPromises)

  const recordUrls = results
    .filter((result) => result.status === fulfilled)
    .map((result) => result.value)

  return {
    body: JSON.stringify(recordUrls),
  }
})
