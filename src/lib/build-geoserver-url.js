import { stringify } from 'query-string'

export default function buildGeoserverUrl({
  url,
  service,
  request,
  encode = true,
  width = 256,
  height = 256,
  ...rest
}) {
  if (!service || !request) {
    return undefined
  }

  const params = stringify(
    { service, request, width, height, ...rest },
    { encode, sort: false }
  )

  return `${url}?${params}`
}
