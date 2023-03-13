import fetch from 'node-fetch'
import https from 'https'

export const fetchResults = new Map()

export async function cachedFetch({
  url,
  options,
  resolveResponseFunction
}) {
  if (fetchResults.has(url)) {
    const fetchResult = fetchResults.get(url)

    if (fetchResult instanceof Error) {
      throw fetchResult
    }

    return fetchResult
  }

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })

  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, 10000)

  const res = await fetch(url, {
    agent: httpsAgent,
    signal: controller.signal,
    ...options,
  })
    .then((res) => resolveResponseFunction(res))
    .catch((err) => err)
    .finally(() => clearTimeout(timeout))

  fetchResults.set(url, res)

  if (res instanceof Error) {
    throw res
  }

  return res
}
