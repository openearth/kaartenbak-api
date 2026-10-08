import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { parseArgs } from 'node:util'
import { config } from 'dotenv'
import { JSDOM } from 'jsdom'
import { listLayers, localRoot, runSync, spatialFields, validateId, verifySync } from './sync-harness.js'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' }, viewer: { type: 'string' },
    event: { type: 'string', default: 'update' },
    offline: { type: 'boolean' }, all: { type: 'boolean' },
    help: { type: 'boolean' },
  },
})
const command = positionals[0]
const fixturesRoot = path.join(localRoot, 'fixtures')
const outputRoot = path.join(localRoot, 'output')

async function savedFixtures() {
  let names
  try {
    names = await fs.readdir(fixturesRoot)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return []
  }
  return Promise.all(names.filter((name) => name.endsWith('.json'))
    .map(async (name) => JSON.parse(await fs.readFile(path.join(fixturesRoot, name), 'utf8'))))
}

async function saveOutput(snapshot, result) {
  const directory = path.join(outputRoot, validateId(snapshot.id))
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'operations.json'), JSON.stringify(result, null, 2) + '\n')
  const uploads = result.operations.filter((item) => item.operation === 'recordsRequest' && item.method === 'PUT')
  for (const [index, upload] of uploads.entries()) {
    await fs.writeFile(path.join(directory, `record-${index + 1}.xml`), upload.body)
  }
  console.log(`Output: ${directory}`)
}

async function main() {
  if (values.help || !command) {
    console.log(`Local sync simulator (no GeoNetwork writes or real email):
  npm run sync:local -- list [--viewer viewer-name]
  npm run sync:local -- capture --id VIEWER_LAYER_ID
  npm run sync:local -- list --offline
  npm run test:sync -- --id VIEWER_LAYER_ID [--event create|update|publish]
  npm run test:sync -- --all

list/capture read published DatoCMS data using .env.
capture also downloads capabilities/metadata/thumbnails via GET.
test is fully offline; edit the captured CMS data and expected abstract before replaying.
Files are stored in .sync-local (ignored by Git).`)
    return
  }
  assert.ok(['list', 'capture', 'test'].includes(command), 'Use list, capture, or test')
  if (command === 'list' || command === 'capture') {
    if (!values.offline) config({ quiet: true })
  }
  if (command === 'list') {
    const rows = values.offline ? (await savedFixtures()).map(({ id, name, viewers, metadata }) => ({
      viewerLayerId: id, name, viewers, metadata,
    })) : await listLayers()
    const filtered = values.viewer ? rows.filter((row) =>
      row.viewers.toLowerCase().includes(values.viewer.toLowerCase())) : rows
    console.table(filtered)
    console.log(`${filtered.length} viewer-layer record(s). Use viewerLayerId, not layerId, for capture/test.`)
    return
  }
  if (command === 'capture') {
    assert.ok(!values.offline && !values.all, 'capture requires a single --id and network access')
    const id = validateId(values.id)
    const row = (await listLayers()).find((item) => item.viewerLayerId === id)
    assert.ok(row, `Published viewer-layer ${id} not found`)
    const snapshot = {
      version: 1, id, name: row.name, viewers: row.viewers, metadata: row.metadata,
      capturedAt: new Date().toISOString(),
      scenario: { viewerRecordExists: true, layerRecordExists: false },
      cms: [], resources: [],
    }
    const result = await runSync(snapshot, { capture: true, eventType: values.event })
    await saveOutput(snapshot, result)
    const uploads = verifySync(snapshot, result, { eventType: values.event })
    const dom = new JSDOM(uploads[0].body, { contentType: 'text/xml' })
    const document = dom.window.document
    snapshot.expected = {
      abstract: document.getElementsByTagName('gmd:abstract')[0].textContent.trim(),
      requiredTags: ['gmd:referenceSystemInfo', 'gmd:EX_GeographicBoundingBox', 'gmd:spatialRepresentationType']
        .filter((tag) => document.getElementsByTagName(tag).length),
      spatialFields: spatialFields(document),
    }
    dom.window.close()
    await fs.mkdir(fixturesRoot, { recursive: true })
    const filename = path.join(fixturesRoot, `${id}.json`)
    await fs.writeFile(filename, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' })
    console.log(`PASS ${snapshot.name} (${snapshot.id}): ${uploads.length} simulated upload(s)`)
    console.log(`Fixture: ${filename}`)
    console.log('Baseline saved from current code; inspect its XML before treating it as the expected result.')
    return
  }
  assert.ok(values.all !== Boolean(values.id), 'Provide either --id or --all')
  const snapshots = values.all ? await savedFixtures() : [
    JSON.parse(await fs.readFile(path.join(fixturesRoot, `${validateId(values.id)}.json`), 'utf8')),
  ]
  assert.ok(snapshots.length, 'No captured fixtures. Run capture first.')
  for (const snapshot of snapshots) {
    const result = await runSync(snapshot, { eventType: values.event })
    await saveOutput(snapshot, result)
    const uploads = verifySync(snapshot, result, { eventType: values.event })
    console.log(`PASS ${snapshot.name} (${snapshot.id}): ${uploads.length} simulated upload(s)`)
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
