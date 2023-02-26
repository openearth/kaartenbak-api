const fetchResults = new Map()

async function cachedFetch(url, options) {
  if (fetchResults.has(url)) {
    return fetchResults.get(url)
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
    ...options
  })
    .then((res) => res)
    .catch((err) => err)
    .finally(() => clearTimeout(timeout))

  fetchResults.set(url, res)

  return linkIsDead
}