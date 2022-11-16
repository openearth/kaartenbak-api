const fetch = require('node-fetch')

const BASE_URL = `https://datahuiswadden.openearth.nl/geonetwork/srv/api`

export const geonetworkRequest = async ({
  url,
  method,
  headers = {},
  body = {},
  options = {
    responseText: false,
  },
}) => {
  // Do request to get X-XSRF-TOKEN and Cookie: see docs https://geonetwork-opensource.org/manuals/3.10.x/en/customizing-application/misc.html
  const me = await fetch(BASE_URL + '/me', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  })

  const cookie = me.headers.get('set-cookie')
  const token = cookie.split(';')[0].split('=')[1]
  const basicAuth =
    'Basic ' +
    Buffer.from(
      process.env.GEONETWORK_API_USERNAME +
        ':' +
        process.env.GEONETWORK_API_PASSWORD
    ).toString('base64')

  // Use X-XSRF-TOKEN and Cookie in the request
  return fetch(BASE_URL + url, {
    method: method,
    ...(method !== 'GET' && { body }),
    headers: {
      Authorization: basicAuth,
      'X-XSRF-TOKEN': token,
      Cookie: cookie.toString(),
      accept: 'application/json',
      ...headers,
    },
  }).then(async (res) => {
    if (options.responseText) {
      return res.text()
    }

    return res.json()
  })
}

export const geonetworkRecordsRequest = (arg) => {
  let url = '/records'

  if (arg.url) {
    url += arg.url
  }

  return geonetworkRequest({
    ...arg,
    url,
  })
}
