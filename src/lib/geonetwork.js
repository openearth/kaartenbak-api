const fetch = require("node-fetch");

const BASE_URL = `https://datahuiswadden.openearth.nl/geonetwork/srv/api`

export const geonetworkRequest = async ({ url, method }) => {
  // Do request to get X-XSRF-TOKEN and Cookie: see docs https://geonetwork-opensource.org/manuals/3.10.x/en/customizing-application/misc.html
  const me = await fetch(BASE_URL + '/me', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  })

  const cookie = me.headers.get('set-cookie')
  const token = cookie.split(';')[0].split('=')[1]

  // Use X-XSRF-TOKEN and Cookie in a request
  return fetch(
    BASE_URL + url,
    {
      method: method,
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(
            process.env.GEONETWORK_API_USERNAME +
              ':' +
              process.env.GEONETWORK_API_PASSWORD
          ).toString('base64'),
        'X-XSRF-TOKEN': token,
        Cookie: cookie.toString(),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  ).then((res) => res.json())
}