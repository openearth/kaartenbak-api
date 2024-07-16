import fetch from 'node-fetch'
import { buildClient } from '@datocms/cma-client-node'
import { curry, times, pipe, split, map } from 'ramda'
import slugify from '@sindresorhus/slugify'

const capitaliseFirstLetter = ([first, ...rest]) =>
  first.toUpperCase() + rest.join('')
const lowerCaseFirstLetter = ([first, ...rest]) =>
  first.toLowerCase() + rest.join('')
const camelCase = pipe(
  slugify,
  split('-'),
  map(capitaliseFirstLetter),
  lowerCaseFirstLetter
)

const defaultFirst = 100

function executeFetch(query, variables = {}, preview = false) {
  const endpoint = preview
    ? 'https://graphql.datocms.com/preview'
    : 'https://graphql.datocms.com/'

  return fetch(endpoint, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.DATO_API_TOKEN,
      'X-Environment': 'main-test-env',
    },
    body: JSON.stringify({ query, variables }),
  })
    .then((response) => response.json())
    .then((response) => {
      if (response.errors) throw Error(JSON.stringify(response, null, 4))
      return response
    })
}

function getPaginatedData(query, variables, preview) {
  return async function (response) {
    const keyRegex = /_all(.+)Meta/
    let allKey

    try {
      allKey = Object.keys(response.data).find((key) => keyRegex.test(key))
    } catch (error) {
      console.log({ query, variables, responseData: response })
      console.log(response)
      console.error(error)
    }

    if (allKey) {
      const { count } = response.data[allKey]
      const [, originalKey] = allKey.match(keyRegex).map(camelCase)
      const itemsInResponse = response.data[originalKey]
      const remainingAmount = count - itemsInResponse.length
      const totalRemainingRequests = Math.ceil(
        remainingAmount / itemsInResponse.length
      )

      const promises = times((iteration) => {
        const skip = iteration * variables.first + itemsInResponse.length
        const currentDate = new Date().toString()
        const args = [query, { ...variables, skip, currentDate }, preview]
        return executeFetch(...args)
      }, totalRemainingRequests)

      await Promise.all(promises).then((responses) =>
        responses.forEach((res) => {
          response.data[originalKey] = [
            ...response.data[originalKey],
            ...res.data[originalKey],
          ]
        })
      )

      delete response.data[allKey]
    }
    return response
  }
}

function returnData(response) {
  return response.data
}

export const datocmsRequest = curry(({ query, variables, preview }) => {
  const args = [query, { first: defaultFirst, ...variables }, preview]

  return executeFetch(...args)
    .then(getPaginatedData(...args))
    .then(returnData)
})

export const datocmsClient = buildClient({ apiToken: process.env.DATO_API_TOKEN })
