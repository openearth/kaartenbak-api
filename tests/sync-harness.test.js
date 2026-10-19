import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { test } from 'node:test'
import { runSync, validateId, verifySync } from './sync-harness.js'

const handlerSource = await fs.readFile(new URL('../src/api/sync-viewer-layer-background.js', import.meta.url), 'utf8')
const metadataSource = await fs.readFile(new URL('../src/lib/fetch-viewer-layer-xml.js', import.meta.url), 'utf8')
const handlerQueries = [...handlerSource.matchAll(/const \w+ = \/\* graphql \*\/ `([\s\S]*?)`/g)]
const metadataQuery = metadataSource.match(/const query = \/\* graphql \*\/ `([\s\S]*?)`/)[1]
const id = 'local-viewer-layer'
const layerId = 'local-layer'
const secondViewerLayerId = 'second-local-viewer-layer'
const orphanViewerLayerId = 'unassigned-viewer-layer'
const wmsUrl = 'https://wms.example.invalid/?service=WMS&request=GetCapabilities'
const capabilities = `<?xml version="1.0"?>
<WMS_Capabilities><Capability><Layer><Layer>
  <Name>workspace:peat</Name><Abstract>CAPABILITIES ABSTRACT MUST NOT BE USED</Abstract>
  <CRS>EPSG:4326</CRS><CRS>EPSG:28992</CRS>
  <KeywordList><Keyword>features</Keyword><Keyword>peat</Keyword></KeywordList>
  <EX_GeographicBoundingBox>
    <westBoundLongitude>3.00</westBoundLongitude><eastBoundLongitude>7.00</eastBoundLongitude>
    <southBoundLatitude>50.00</southBoundLatitude><northBoundLatitude>54.00</northBoundLatitude>
  </EX_GeographicBoundingBox>
</Layer></Layer></Capability></WMS_Capabilities>`

function fixture(description = '<p>CMS <strong>description</strong> &amp; details.</p><p>Second paragraph.</p>',
  expected = 'CMS description & details.\n\nSecond paragraph.') {
  const viewerLayer = {
    id, useFactsheetAsMetadata: false, externalMetadata: null,
    inspireMetadata: {
      abstract: 'INSPIRE abstract', _updatedAt: '2026-10-07T00:00:00Z',
      descriptivekeywordsKeywords: [], topiccategories: [{ topicCategoryItem: [] }], links: [],
    },
    factsheets: [], links: [], pointOfContactOrganisations: [],
    layer: { name: 'Test peat layer', description, url: 'https://wms.example.invalid/',
      layer: 'workspace:peat', indexableWfsProperties: [], thumbnails: [] },
  }
  return {
    version: 1, id, name: 'Test peat layer',
    scenario: { viewerRecordExists: true, layerRecordExists: false },
    cms: [
      { query: handlerQueries[0][1], variables: {}, data: { menus: [
        { id: 'viewer', parent: null,
          geonetwork: { baseUrl: 'https://local.example.invalid/', username: 'local', password: 'local' },
          errorNotificationContacts: [{ email: 'local@example.invalid' }], children: [] },
        { id: 'menu', parent: { id: 'viewer' }, children: [{ id }] },
      ] } },
      { query: metadataQuery, variables: { id }, data: { viewerLayer } },
      { query: handlerQueries[1][1], variables: { id },
        data: { viewerLayer: { layer: { id: layerId, thumbnails: [] } } } },
    ],
    resources: [{ url: wmsUrl, status: 200, contentType: 'application/xml',
      bodyBase64: Buffer.from(capabilities).toString('base64') }],
    expected: {
      abstract: `INSPIRE abstract${expected ? `\n\n${expected}` : ''}`,
      requiredTags: ['gmd:referenceSystemInfo', 'gmd:EX_GeographicBoundingBox', 'gmd:spatialRepresentationType'],
    },
  }
}

function layerWebhookFixture(viewerLayers) {
  const snapshot = fixture()
  if (viewerLayers.some(({ id: viewerLayerId }) => viewerLayerId === secondViewerLayerId)) {
    const menuQuery = snapshot.cms[0]
    menuQuery.data.menus[1].children.push({ id: secondViewerLayerId })
    const metadataEntry = structuredClone(snapshot.cms.find((entry) => entry.query === metadataQuery))
    metadataEntry.variables = { id: secondViewerLayerId }
    metadataEntry.data.viewerLayer.id = secondViewerLayerId
    snapshot.cms.push(metadataEntry, {
      query: handlerQueries[1][1],
      variables: { id: secondViewerLayerId },
      data: { viewerLayer: { layer: { id: layerId, thumbnails: [] } } },
    })
  }
  snapshot.cms.push({
    query: handlerQueries[3][1],
    variables: { id: layerId },
    data: { viewerLayers },
  })
  return snapshot
}

for (const eventType of ['create', 'update', 'publish']) {
  test(`real webhook: ${eventType}, CMS plain text, preserved capabilities`, async () => {
    const snapshot = fixture()
    const before = structuredClone(snapshot)
    const result = await runSync(snapshot, { eventType })
    const [upload] = verifySync(snapshot, result, { eventType })
    assert.ok(!upload.body.includes('CAPABILITIES ABSTRACT MUST NOT BE USED'))
    assert.ok(upload.body.includes('http://www.opengis.net/def/crs/EPSG/0/4326'))
    for (const coordinate of ['3.00', '7.00', '50.00', '54.00']) {
      assert.ok(upload.body.includes(`<gco:Decimal>${coordinate}</gco:Decimal>`))
    }
    assert.deepEqual(snapshot, before, 'Replay must not alter captured inputs')
  })
}

test('successful sync writes only one summary with upload and thumbnail outcomes', async () => {
  const snapshot = fixture()
  const result = await runSync(snapshot)
  verifySync(snapshot, result)
  assert.equal(result.logs.length, 1)
  const [{ level, args: [message, summary] }] = result.logs
  assert.equal(level, 'log')
  assert.equal(message, '[LOG] Sync finished')
  assert.equal(summary.id, id)
  assert.equal(summary.type, 'viewer_layer')
  assert.equal(summary.eventType, 'update')
  assert.equal(summary.status, 'completed')
  assert.ok(summary.durationMs >= 0)
  assert.equal(summary.outcomes.length, 1)
  assert.equal(summary.outcomes[0].layerTitle, 'Test peat layer')
  assert.equal(summary.outcomes[0].xml, 'uploaded')
  assert.equal(summary.outcomes[0].thumbnails, 'synced')
  assert.ok(!JSON.stringify(result.logs).includes('<gmd:MD_Metadata'))
})

test('GeoNetwork processing failure is logged and summarised with the failed step', async () => {
  const snapshot = fixture()
  snapshot.scenario.uploadReport = {
    numberOfRecordsProcessed: 0,
    numberOfRecordsWithErrors: 1,
    errors: [{ message: 'Invalid metadata' }],
  }
  const result = await runSync(snapshot)
  assert.equal(result.logs.filter(({ level }) => level === 'error').length, 1)
  const summaries = result.logs.filter(({ args }) => args[0] === '[LOG] Sync finished')
  assert.equal(summaries.length, 1)
  const summary = summaries[0].args[1]
  assert.equal(summary.status, 'failed')
  assert.equal(summary.outcomes[0].step, 'upload XML')
  assert.match(summary.outcomes[0].error, /Invalid metadata/)
  assert.equal(summary.outcomes[0].thumbnails, 'not synced')
  assert.ok(result.operations.some(({ operation }) => operation === 'email'))
})

test('missing GeoNetwork processing report is not summarised as confirmed success', async () => {
  const snapshot = fixture()
  snapshot.scenario.uploadReport = {}
  const result = await runSync(snapshot)
  assert.equal(result.logs.length, 1)
  const summary = result.logs[0].args[1]
  assert.equal(summary.status, 'unconfirmed')
  assert.equal(summary.outcomes[0].xml, 'unknown (no processing report)')
})

test('thumbnail failure keeps the successful XML upload in the final summary', async () => {
  const snapshot = fixture()
  snapshot.cms[2].data.viewerLayer.layer.thumbnails = [
    { url: 'https://assets.example.invalid/missing.png', filename: 'missing.png' },
  ]
  const result = await runSync(snapshot)
  const summary = result.logs.find(({ args }) => args[0] === '[LOG] Sync finished').args[1]
  assert.equal(summary.status, 'failed')
  assert.equal(summary.outcomes[0].xml, 'uploaded')
  assert.equal(summary.outcomes[0].thumbnails, 'not synced')
  assert.equal(summary.outcomes[0].step, 'sync thumbnails')
})

test('layer webhook syncs all linked viewer-layers and skips ones outside a viewer', async () => {
  const snapshot = layerWebhookFixture([
    { id }, { id: secondViewerLayerId }, { id: orphanViewerLayerId },
  ])
  const result = await runSync(snapshot, {
    eventType: 'publish',
    webhookType: 'layer',
    webhookId: layerId,
  })
  const uploads = result.operations.filter((operation) =>
    operation.operation === 'recordsRequest' && operation.method === 'PUT')

  assert.equal(uploads.length, 2)
  assert.deepEqual(uploads.map(({ body }) =>
    body.match(/<gmd:fileIdentifier>\s*<gco:CharacterString>(.*?)<\/gco:CharacterString>/s)?.[1]
  ).sort(), [id, secondViewerLayerId].sort())
  assert.ok(result.logs.find(({ args }) => args[0] === '[LOG] Sync finished')
    .args[1].outcomes.some((outcome) =>
      outcome.viewerLayerId === orphanViewerLayerId &&
      outcome.reason === 'No GeoNetwork instances found'))
})

test('layer webhook with no linked viewer-layers logs that nothing matched', async () => {
  const snapshot = layerWebhookFixture([])
  const result = await runSync(snapshot, {
    webhookType: 'layer',
    webhookId: layerId,
  })

  assert.equal(result.response.statusCode, 202)
  assert.deepEqual(result.failures, [])
  assert.equal(result.operations.filter((operation) =>
    operation.operation === 'recordsRequest' && operation.method === 'PUT').length, 0)
  assert.ok(result.logs.find(({ args }) => args[0] === '[LOG] Sync finished')
    .args[1].outcomes.some((outcome) => outcome.reason === 'No viewer layers linked to layer'))
})

test('layer webhook errors notify contacts for linked viewer-layers', async () => {
  const snapshot = layerWebhookFixture([{ id }])
  snapshot.cms = snapshot.cms.filter((entry) => entry.query !== metadataQuery)
  const result = await runSync(snapshot, {
    webhookType: 'layer',
    webhookId: layerId,
  })

  assert.equal(result.response.statusCode, 202)
  assert.ok(result.operations.some(({ operation, message }) =>
    operation === 'email' &&
    message.Messages[0].To.some(({ Email }) => Email === 'local@example.invalid')
  ))
})

for (const [description, expected] of [
  [null, ''], ['', ''], ['<p>&nbsp;<br></p>', ''],
  ['<p>Line one<br>Line two</p>', 'Line one\nLine two'],
  ['<p>Marker ]]&gt; &amp; text</p>', 'Marker ]]> & text'],
]) {
  test(`HTML/empty description: ${JSON.stringify(description)}`, async () => {
    const snapshot = fixture(description, expected)
    verifySync(snapshot, await runSync(snapshot))
  })
}

test('legacy migration deletes only the simulated layer record', async () => {
  const snapshot = fixture()
  snapshot.scenario.layerRecordExists = true
  const result = await runSync(snapshot)
  verifySync(snapshot, result)
  assert.deepEqual(result.operations.filter(({ operation }) => operation === 'deleteRecord')
    .map(({ id }) => id), [layerId])
})

test('real thumbnail flow uses captured bytes and simulated attachment operations', async () => {
  const snapshot = fixture()
  const thumbnail = { url: 'https://assets.example.invalid/thumbnail.png', filename: 'thumbnail.png' }
  snapshot.cms[2].data.viewerLayer.layer.thumbnails = [thumbnail]
  snapshot.resources.push({
    url: thumbnail.url, status: 200, contentType: 'image/png',
    bodyBase64: Buffer.from('local thumbnail bytes').toString('base64'),
  })
  const result = await runSync(snapshot)
  verifySync(snapshot, result)
  assert.ok(result.operations.some(({ method, url }) => method === 'POST' && url?.endsWith('/attachments')))
  assert.ok(result.operations.some(({ url }) => url?.includes('/processes/thumbnail-add')))
})

test('uncaptured WMS request fails even when the production helper catches it', async () => {
  const snapshot = fixture()
  snapshot.resources = []
  const result = await runSync(snapshot)
  assert.ok(result.failures.some((message) => message.includes('Uncaptured resource')))
  assert.throws(() => verifySync(snapshot, result), /Unexpected external request/)
})

test('202 after handler failure is not a passing test; email is captured locally', async () => {
  const snapshot = fixture()
  snapshot.cms = snapshot.cms.slice(0, 1)
  const result = await runSync(snapshot)
  assert.equal(result.response.statusCode, 202)
  assert.ok(result.operations.some(({ operation }) => operation === 'email'))
  assert.throws(() => verifySync(snapshot, result))
})

test('no matching GeoNetwork destination is an explicit test failure', async () => {
  const snapshot = fixture()
  snapshot.cms[0].data.menus[0].geonetwork = null
  const result = await runSync(snapshot)
  assert.throws(() => verifySync(snapshot, result), /No XML uploaded/)
})

test('changed expected abstract fails instead of silently updating the baseline', async () => {
  const snapshot = fixture()
  snapshot.expected.abstract = 'Incorrect expectation'
  const result = await runSync(snapshot)
  assert.throws(() => verifySync(snapshot, result), /Abstract differs/)
})

test('all associated viewer destinations receive an upload', async () => {
  const snapshot = fixture()
  snapshot.cms[0].data.menus.push({
    id: 'second-viewer', parent: null, children: [{ id }],
    errorNotificationContacts: [],
    geonetwork: { baseUrl: 'https://second.example.invalid/', username: 'local', password: 'local' },
  })
  const result = await runSync(snapshot)
  const uploads = verifySync(snapshot, result)
  assert.equal(uploads.length, 2)
  result.operations.splice(result.operations.indexOf(uploads[1]), 1)
  assert.throws(() => verifySync(snapshot, result), /Every resolved GeoNetwork destination/)
})

test('changed spatial baseline fails even when spatial tags still exist', async () => {
  const snapshot = fixture()
  snapshot.expected.spatialFields = {}
  const result = await runSync(snapshot)
  assert.throws(() => verifySync(snapshot, result), /Capabilities-derived spatial fields differ/)
})

test('unsafe file IDs and unsupported events are rejected', async () => {
  assert.throws(() => validateId('..\\secrets'))
  await assert.rejects(runSync(fixture(), { eventType: 'delete' }), /Event must be/)
})
