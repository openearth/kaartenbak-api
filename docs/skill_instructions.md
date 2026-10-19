# Workflow of the `test-local-sync` skill

## Files involved

| File | Role |
|---|---|
| `.github\skills\test-local-sync\SKILL.md` | The instructions the assistant follows. |
| `tests\sync-cli.js` | The commands you run (`list`, `capture`, `test`). |
| `tests\sync-harness.js` | The machinery that runs the real handler with stand-ins. |
| `tests\sync-harness.test.js` | The `npm test` checks, using made-up data. |
| `src\api\sync-viewer-layer-background.js` | The real handler, which gets run. |

## Step 1: Find the layer (`npm run sync:local -- list`)

1. **`main`** (`sync-cli.js`) reads the command and options, such as `--viewer`.
2. **`listLayers`** (`sync-harness.js`) asks DatoCMS for all viewer-layers and menus. It works out each layer's viewer name by walking up the menu tree, and its metadata type (factsheet, inspire, external, none).
3. **`cmsRead`** (`sync-harness.js`) sends the DatoCMS request. It reads only, refuses any change request, and fetches page by page.
4. With `--offline`, **`savedFixtures`** (`sync-cli.js`) lists the saved copies instead, so no internet is needed.

Pick the layer by its `viewerLayerId`, not the underlying layer ID.

## Step 2: Save a copy (`npm run sync:local -- capture --id <ID>`)

1. **`validateId`** (`sync-harness.js`): checks the ID has only letters, digits, `_` and `-`, so nothing odd ends up in a file path.
2. **`runSync`** (`sync-harness.js`), in capture mode: runs the real handler. When the handler asks for something not saved yet, the harness fetches it, read-only, and stores it.
   - DatoCMS answers come through `cmsRead`. GeoNetwork logins and email addresses are removed and replaced by dummy values.
   - Map server and thumbnail responses are downloaded with GET only.
3. **`saveOutput`** (`sync-cli.js`): writes the results (locations below).
4. **`verifySync`** (`sync-harness.js`): checks the result of the run.
5. Inside the `capture` branch of `main` (`sync-cli.js`), not a separate function: the abstract, the required XML tags and the spatial values are read from the generated XML. **`spatialFields`** (`sync-harness.js`) extracts the spatial values. They are stored as the "expected" result. This baseline comes from the current code, so it isn't proof the output is right.
6. Also inside the `capture` branch: the fixture file is written. It refuses to overwrite an existing one.

## Step 3: Replay (`npm run test:sync -- --id <ID>`, or `--all`)

1. `main` reads the saved fixture from `.sync-local\fixtures\`.
2. **`runSync`**, in replay mode: loads `sync-viewer-layer-background.js` and everything it imports from `src\`. It swaps in the stand-ins:
   - DatoCMS: reads the saved data.
   - GeoNetwork: only notes down what it was asked to do.
   - Email: only notes down the message.
   - Map server and thumbnails: read the saved responses.

   Then it sends the handler a made-up webhook (default event: update; `--event create` or `publish` is possible). Any request that wasn't saved counts as a failure.
3. **`saveOutput`** writes the results.
4. **`verifySync`** checks:
   - the handler returned 202
   - no failures or errors were logged
   - no error email was produced
   - XML was uploaded to every GeoNetwork instance it should reach
   - the upload used the right method and address for the event type
   - the XML has the right record ID and a non-empty abstract
   - the abstract and spatial values match the saved baseline

## Step 4: Inspect and report

The generated XML is opened and compared with what you expect. `operations.json` shows which XML files belong to the current run. The report lists the commands run, pass or fail, and the XML paths.

**`npm test`** is separate. It runs `tests\sync-harness.test.js` with made-up data and checks the rules independently of any real layer.

## Where files are stored

Everything is in `.sync-local\` in the repository root, which Git ignores.

| What | Location |
|---|---|
| Saved copy of the layer's data, plus expected results | `.sync-local\fixtures\<VIEWER_LAYER_ID>.json` |
| Log of what the fake GeoNetwork and fake email were asked to do | `.sync-local\output\<VIEWER_LAYER_ID>\operations.json` |
| The XML that would have been uploaded | `.sync-local\output\<VIEWER_LAYER_ID>\record-1.xml`, `record-2.xml`, … (one per GeoNetwork instance) |

Each run overwrites the same output folder. Old `record-N.xml` files can stay behind, so check `operations.json` for the current ones.
