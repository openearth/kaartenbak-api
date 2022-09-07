const fetch = require('node-fetch')
import { buildClient } from '@datocms/cma-client-node'

const datocmsRequest = ({ query, variables = {}, preview = false }) => {
  const endpoint = preview
    ? 'https://graphql.datocms.com/preview'
    : 'https://graphql.datocms.com/'

  return fetch(endpoint, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.DATO_API_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })
    .then((response) => response.json())
    .then((response) => {
      if (response.errors) throw Error(JSON.stringify(response, null, 4))
      return response.data
    })
}

const datocmsClient = buildClient({ apiToken: process.env.DATO_API_TOKEN })

module.exports = {
  datocmsRequest,
  datocmsClient
}
