import path, { dirname } from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { formatMenusRecursive } from '../lib/format-menu.js'
import { datocmsRequest } from '../lib/datocms.js'
import { buildMenuTree } from '../lib/build-menu-tree.js'
import { Geonetwork } from '../lib/geonetwork.js'
import { detectFormatWith } from '../lib/metadata-formats.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = path.join(__dirname, '../../.env')

dotenv.config({
    path: envPath,
})

export const instances = [
    {
        name: "nl2120",
        datoApiKey: process.env.DATO_API_KEY_NL2120,
    },
    {
        name: "openearth-rws-viewer",
        datoApiKey: process.env.DATO_API_KEY_OPENEARTH_RWS_VIEWER,
    },
];


const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0, $locale: SiteLocale = nl) {
  menus: allMenus(first: $first, skip: $skip, locale: $locale) {
    id
    name
    geonetwork {
      baseUrl
      username
      password
    }
    children: viewerLayers {
      externalMetadata
      layer {
        id
        name
        url
        }
        }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}`

const findExternalMetadata = (menuTree) => {
    const externalMetadatas = []
    let currentGeonetwork = null

    function findInMenu(children) {
        for (const child of children) {
            const { geonetwork, externalMetadata, children } = child

            if (geonetwork) {
                currentGeonetwork = geonetwork
            }

            if (externalMetadata) {
                externalMetadatas.push({
                    sourceUrl: externalMetadata,
                    destination: {
                        geonetwork: currentGeonetwork
                    }
                })
            }

            if (children) {
                findInMenu(children)
            }
        }
    }

    findInMenu(menuTree)

    return externalMetadatas
}

async function sync() {
    try {
        for (const instance of instances) {
            const { menus } = await datocmsRequest({
                query: viewersWithLayersQuery,
                token: instance.datoApiKey
            })

            const formattedMenus = formatMenusRecursive(menus)
            const menuTree = buildMenuTree(formattedMenus)
            const externalMetadatas = findExternalMetadata(menuTree)

            await syncExternalMetadata(externalMetadatas)

            console.log(`Synced ${externalMetadatas.length} external metadata instances for ${instance.name}`)
        }
    } catch (err) {
        console.error(err)
    }
}

const syncExternalMetadata = async (externalMetadatas) => {
    for (const externalMetadata of externalMetadatas) {
        const { sourceUrl, destination } = externalMetadata
        const geoNetworkUrl = destination.geonetwork.baseUrl + '/geonetwork/srv/api'

        const transformedSource = transformSourceUrl(sourceUrl)

        const geonetwork = new Geonetwork(geoNetworkUrl, destination.geonetwork.username, destination.geonetwork.password)

        // TODO implement transformWith
        const transformWith = await detectTransform(transformedSource)

        const response = await geonetwork.putRecord({
            params: {
                metadataType: "METADATA",
                uuidProcessing: "OVERWRITE",
                url: transformedSource,
                // ...(transformWith ? { transformWith } : {})
            },
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/xml'
            }
        })

        console.log(`Synced ${sourceUrl} to ${transformedSource}`)
    }
}

const detectTransform = async (transformedSource) => {
    const source = await fetch(`${transformedSource}/formatters/xml`)
    const sourceContent = await source.text()

    return detectFormatWith(sourceContent)
}

const transformSourceUrl = (sourceUrl) => {
    const url = new URL(sourceUrl)
    const baseUrl = url.origin
    const uuid = sourceUrl.split('/').pop()

    return `${baseUrl}/geonetwork/srv/api/records/${uuid}`
}

sync()
