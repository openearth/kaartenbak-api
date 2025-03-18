import fetch from 'node-fetch'

class GeoNetworkError extends Error {
  constructor(description, error) {
    super(`${description}\n\n${JSON.stringify(error, null, 2)}`)

    this.code = error.code
  }
}

export class Geonetwork {
  #baseUrl
  #username
  #password

  constructor(baseUrl, username, password) {
    this.#baseUrl = baseUrl
    this.#username = username
    this.#password = password
  }

  async #request({
    url,
    method,
    headers = {},
    body = {},
    options = {
      responseText: false,
    },
    params = {},
  }) {
    // Request to get X-XSRF-TOKEN and Cookie: see docs https://geonetwork-opensource.org/manuals/3.10.x/en/customizing-application/misc.html
    const me = await fetch(this.#baseUrl + '/me', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })

    const cookie = me.headers.get('set-cookie')

    const token = cookie.split(';')[0].split('=')[1]
    const basicAuth =
      'Basic ' +
      Buffer.from(this.#username + ':' + this.#password).toString('base64')

    const requestUrl = new URL(this.#baseUrl + url)

    Object.entries(params).forEach(([key, value]) => {
      requestUrl.searchParams.set(key, value)
    })

    // Use X-XSRF-TOKEN and Cookie in the request
    return fetch(requestUrl.toString(), {
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
      if (!res.ok) {
        const error = await res.json()

        throw new GeoNetworkError(`Error while posting to ${url}`, error)
      }

      if (options.responseText) {
        return res.text()
      }

      return res.json()
    })
  }

  recordsRequest(arg) {
    let url = '/records'

    if (arg.url) {
      url += arg.url
    }

    if (arg.params) {
      const params = new URLSearchParams(arg.params);
      if (url.includes('?')) {
        url += '&' + params.toString();
      } else {
        url += '?' + params.toString();
      }
    }

    return this.#request({
      ...arg,
      url,
    })
  }
}
