import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import fetch, { Response } from 'node-fetch'
import { JSDOM } from 'jsdom'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = path.join(root, 'src')
const token = 'local-test-token'

export const localRoot = path.join(root, '.sync-local')

export function validateId(id) {
  assert.match(id || '', /^[A-Za-z0-9_-]+$/, 'Provide a valid viewer-layer --id')
  return id
}

export async function cmsRead(query, variables = {}) {
  assert.ok(process.env.DATO_API_TOKEN, 'DATO_API_TOKEN is required for list/capture; replay needs no token')
  assert.ok(!/\bmutation\b/i.test(query), 'Only read-only GraphQL queries are allowed')
  const data = {}
  let skip = 0
  while (true) {
    const response = await fetch('https://graphql.datocms.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DATO_API_TOKEN}`,
        'X-Environment': 'main',
      },
      body: JSON.stringify({ query, variables: { first: 100, ...variables, skip } }),
      signal: AbortSignal.timeout(60000),
    })
    assert.ok(response.ok, `DatoCMS HTTP ${response.status}`)
    const result = await response.json()
    assert.ok(!result.errors, JSON.stringify(result.errors))
    assert.ok(result.data, 'DatoCMS returned no data')
    const meta = Object.keys(result.data).find((key) => /^_all.*Meta$/.test(key))
    const collection = meta && Object.keys(result.data).find((key) => Array.isArray(result.data[key]))
    if (!collection) return result.data
    const items = result.data[collection]
    data[collection] = [...(data[collection] || []), ...items]
    if (data[collection].length >= result.data[meta].count) return data
    assert.ok(items.length, 'DatoCMS pagination made no progress')
    skip += items.length
  }
}

export async function listLayers() {
  const [{ viewerLayers }, { menus }] = await Promise.all([
    cmsRead(/* graphql */ `
      query LocalViewerLayers($first: IntType, $skip: IntType) {
        viewerLayers: allViewerLayers(first: $first, skip: $skip) {
          id useFactsheetAsMetadata externalMetadata
          inspireMetadata { id }
          layer { id name }
        }
        _allViewerLayersMeta { count }
      }`),
    cmsRead(/* graphql */ `
      query LocalMenus($first: IntType, $skip: IntType) {
        menus: allMenus(first: $first, skip: $skip) {
          id name parent { id } viewerLayers { id }
        }
        _allMenusMeta { count }
      }`),
  ])
  function viewerName(menu) {
    const seen = new Set()
    while (menu.parent) {
      assert.ok(!seen.has(menu.id), 'Menu cycle detected')
      seen.add(menu.id)
      const parent = menus.find((item) => item.id === menu.parent.id)
      assert.ok(parent, `Missing parent menu ${menu.parent.id}`)
      menu = parent
    }
    return menu.name
  }
  return viewerLayers.map((record) => ({
    viewerLayerId: record.id,
    layerId: record.layer?.id || '',
    name: record.layer?.name || '(no linked layer)',
    viewers: [...new Set(menus.filter((menu) => menu.viewerLayers.some(({ id }) => id === record.id))
      .map(viewerName))].join(', ') || '(unassigned)',
    metadata: record.useFactsheetAsMetadata ? 'factsheet'
      : record.inspireMetadata ? 'inspire' : record.externalMetadata ? 'external' : 'none',
  })).sort((a, b) => a.name.localeCompare(b.name))
}

function requestKey(query, variables) {
  return JSON.stringify([query.replace(/\s+/g, ' ').trim(), variables || {}])
}

export async function runSync(snapshot, { capture = false, eventType = 'update' } = {}) {
  validateId(snapshot.id)
  assert.ok(['create', 'update', 'publish'].includes(eventType), 'Event must be create, update, or publish')
  const operations = []
  const failures = []
  const logs = []
  const modules = new Map()
  const context = vm.createContext({
    Buffer, URL, URLSearchParams,
    process: { env: { SYNC_LAYER_API_TOKEN: token, MAILJET_FROM_EMAIL: 'local@example.invalid' } },
    console: Object.fromEntries(['log', 'warn', 'error'].map((level) => [
      level, (...args) => logs.push({ level, args }),
    ])),
    fetch: () => {
      failures.push('Unexpected global fetch')
      throw new Error('Network access is blocked in the local sync handler')
    },
  })
  async function datocmsRequest({ query, variables }) {
    const key = requestKey(query, variables)
    let entry = snapshot.cms.find((item) => requestKey(item.query, item.variables) === key)
    if (!entry && capture) {
      // Never fetch or save real GeoNetwork credentials or notification recipients.
      const safeQuery = query.replace(/\busername\b/g, '').replace(/\bpassword\b/g, '')
        .replace(/errorNotificationContacts\s*\{\s*email\s*\}/g, '')
      const data = await cmsRead(safeQuery, variables)
      if (data.menus) {
        for (const menu of data.menus) {
          menu.errorNotificationContacts = [{ email: 'local@example.invalid' }]
          if (menu.geonetwork) {
            menu.geonetwork = {
              baseUrl: `https://local-${menu.id}.example.invalid/`,
              username: 'local', password: 'local',
            }
          }
        }
      }
      entry = { query, variables: variables || {}, data }
      snapshot.cms.push(entry)
    }
    if (!entry) {
      failures.push('Uncaptured CMS query; capture this layer again')
      throw new Error(failures.at(-1))
    }
    return structuredClone(entry.data)
  }
  async function resourceFetch(url, options = {}) {
    url = String(url)
    if ((options.method || 'GET').toUpperCase() !== 'GET') {
      failures.push(`Blocked non-GET resource request: ${url}`)
      throw new Error(failures.at(-1))
    }
    let entry = snapshot.resources.find((item) => item.url === url)
    if (!entry && capture) {
      try {
        const parsed = new URL(url)
        assert.ok(['http:', 'https:'].includes(parsed.protocol), 'Only HTTP(S) resources are supported')
        assert.ok(!parsed.username && !parsed.password, 'Credential-bearing resource URLs are not supported')
        const response = await fetch(url, {
          ...options, redirect: 'error', signal: AbortSignal.timeout(60000),
        })
        assert.ok(response.ok, `Resource HTTP ${response.status}: ${url}`)
        entry = {
          url, status: response.status,
          contentType: response.headers.get('content-type'),
          bodyBase64: Buffer.from(await response.arrayBuffer()).toString('base64'),
        }
        snapshot.resources.push(entry)
      } catch (error) {
        failures.push(`Resource capture failed: ${url}: ${error.message}`)
        throw error
      }
    }
    if (!entry) {
      failures.push(`Uncaptured resource: ${url}`)
      throw new Error(failures.at(-1))
    }
    return new Response(Buffer.from(entry.bodyBase64, 'base64'), {
      status: entry.status, headers: { 'content-type': entry.contentType || 'application/octet-stream' },
    })
  }
  class LocalGeonetwork {
    constructor(baseUrl) {
      this.baseUrl = baseUrl
    }
    async recordExists(id) {
      operations.push({ operation: 'recordExists', baseUrl: this.baseUrl, id })
      return id === snapshot.id ? snapshot.scenario.viewerRecordExists : snapshot.scenario.layerRecordExists
    }
    async deleteRecord(id) {
      operations.push({ operation: 'deleteRecord', baseUrl: this.baseUrl, id })
    }
    async recordsRequest(request) {
      const { body, ...details } = request
      operations.push({
        operation: 'recordsRequest', baseUrl: this.baseUrl, ...details,
        ...(typeof body === 'string' ? { body } : body ? { body: '(thumbnail form data)' } : {}),
      })
      if (request.method === 'PUT') return {}
      if (request.method === 'GET' && request.url.endsWith('/attachments')) return []
      if (request.method === 'POST' && request.url.endsWith('/attachments')) {
        return { metadataId: snapshot.id, url: 'https://local.example.invalid/thumbnail.png' }
      }
      if (request.method === 'POST' && request.url.includes('/processes/thumbnail-add')) return ''
      failures.push(`Unexpected GeoNetwork operation: ${request.method} ${request.url}`)
      throw new Error(failures.at(-1))
    }
  }
  class LocalMailjet {
    post() {
      return { request: async (message) => {
        operations.push({ operation: 'email', message })
        return {}
      } }
    }
  }
  function synthetic(identifier, exports) {
    const module = new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context, identifier })
    modules.set(identifier, module)
    return module
  }
  const allowedPackages = new Set(['xml-js', 'xml-escape', 'jsdom', 'form-data'])
  async function load(filename) {
    if (modules.has(filename)) return modules.get(filename)
    if (filename === path.join(sourceRoot, 'lib', 'datocms.js')) {
      return synthetic(filename, { datocmsRequest })
    }
    if (filename === path.join(sourceRoot, 'lib', 'geonetwork.js')) {
      return synthetic(filename, { Geonetwork: LocalGeonetwork })
    }
    const module = new vm.SourceTextModule(await fs.readFile(filename, 'utf8'), {
      context, identifier: filename,
    })
    modules.set(filename, module)
    await module.link(async (specifier, parent) => {
      if (specifier.startsWith('.')) {
        let resolved = path.resolve(path.dirname(parent.identifier), specifier)
        if (!path.extname(resolved)) resolved += '.js'
        assert.ok(resolved.startsWith(sourceRoot + path.sep), 'Imports outside src are blocked')
        return load(resolved)
      }
      if (modules.has(specifier)) return modules.get(specifier)
      if (specifier === 'node-fetch') return synthetic(specifier, { default: resourceFetch })
      if (specifier === 'node-mailjet') return synthetic(specifier, { default: LocalMailjet })
      if (specifier === 'https') return synthetic(specifier, { default: { Agent: https.Agent } })
      assert.ok(allowedPackages.has(specifier), `Unapproved dependency ${specifier}; network-capable imports are blocked`)
      return synthetic(specifier, await import(specifier))
    })
    return module
  }
  const module = await load(path.join(sourceRoot, 'api', 'sync-viewer-layer-background.js'))
  await module.evaluate()
  const webhook = {
    entity: { id: snapshot.id }, event_type: eventType,
    related_entities: [{ type: 'item_type', attributes: { api_key: 'viewer_layer' } }],
  }
  const response = await module.namespace.handler({
    headers: { 'x-api-key': token }, httpMethod: 'POST',
    path: '/api/sync-viewer-layer-background', body: JSON.stringify(webhook),
  })
  return { response, operations, failures, logs, webhook }
}

export function verifySync(snapshot, result, { eventType = 'update' } = {}) {
  assert.equal(result.response.statusCode, 202)
  assert.deepEqual(result.failures, [], 'Unexpected external request or uncaptured input')
  assert.ok(!result.logs.some(({ level }) => level === 'error'),
    `Handler errors: ${JSON.stringify(result.logs.filter(({ level }) => level === 'error'))}`)
  assert.ok(!result.operations.some(({ operation }) => operation === 'email'), 'Sync generated an error notification')
  const uploads = result.operations.filter((item) => item.operation === 'recordsRequest' && item.method === 'PUT')
  assert.ok(uploads.length, 'No XML uploaded: HTTP 202 alone does not indicate successful sync')
  const destinations = result.operations.filter((item) =>
    item.operation === 'recordExists' && item.id === snapshot.id).map((item) => item.baseUrl).sort()
  assert.deepEqual(uploads.map((item) => item.baseUrl).sort(), destinations,
    'Every resolved GeoNetwork destination must receive exactly one XML upload')
  for (const upload of uploads) {
    assert.equal(upload.headers['Content-Type'], 'application/xml')
    assert.equal(upload.url, eventType === 'create' ? '?publishToAll=true'
      : '?uuidProcessing=OVERWRITE&publishToAll=true')
    const dom = new JSDOM(upload.body, { contentType: 'text/xml' })
    try {
      const document = dom.window.document
      assert.equal(document.getElementsByTagName('gmd:fileIdentifier')[0]?.textContent.trim(), snapshot.id)
      const abstract = document.getElementsByTagName('gmd:abstract')[0]?.textContent.trim()
      assert.ok(abstract, 'Missing or empty abstract')
      if (snapshot.expected) {
        assert.equal(abstract, snapshot.expected.abstract, 'Abstract differs from the fixture expectation')
        for (const tag of snapshot.expected.requiredTags || []) {
          assert.ok(document.getElementsByTagName(tag).length, `Missing ${tag}`)
        }
        if (snapshot.expected.spatialFields) {
          assert.deepEqual(spatialFields(document), snapshot.expected.spatialFields,
            'Capabilities-derived spatial fields differ from the fixture expectation')
        }
      }
    } finally {
      dom.window.close()
    }
  }
  return uploads
}

export function spatialFields(document) {
  return Object.fromEntries([
    'gmd:referenceSystemInfo', 'gmd:westBoundLongitude', 'gmd:eastBoundLongitude',
    'gmd:southBoundLatitude', 'gmd:northBoundLatitude', 'gmd:MD_SpatialRepresentationTypeCode',
  ].map((tag) => [tag, [...document.getElementsByTagName(tag)].map((element) => ({
    text: element.textContent.trim(),
    code: element.getAttribute('codeListValue'),
    anchors: [...element.getElementsByTagName('gmx:Anchor')].map((anchor) => anchor.getAttribute('xlink:href')),
  }))]))
}
