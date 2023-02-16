const fetch = require('node-fetch')

class Geonetwork {
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
  }) {
    console.log(this.#baseUrl)
    console.log("private request")
    // Request to get X-XSRF-TOKEN and Cookie: see docs https://geonetwork-opensource.org/manuals/3.10.x/en/customizing-application/misc.html
    const me = await fetch(this.#baseUrl + '/me', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })

    console.log(me)

    const cookie = me.headers.get('set-cookie')
    const token = cookie.split(';')[0].split('=')[1]
    const basicAuth =
      'Basic ' +
      Buffer.from(this.#username + ':' + this.#password).toString('base64')

    // Use X-XSRF-TOKEN and Cookie in the request
    return fetch(this.#baseUrl + url, {
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
        const text = res.text()

        console.log(text)

        return text
      }

      const json = res.json()

      console.log(json)

      return json
    })
  }

  recordsRequest(arg) {
    let url = '/records'

    if (arg.url) {
      url += arg.url
    }

    return this.#request({
      ...arg,
      url,
    })
  }
}

module.exports = {
  Geonetwork
}