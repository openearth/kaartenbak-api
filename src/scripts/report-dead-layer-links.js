import path, { dirname } from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = path.join(__dirname, '../../.env')

dotenv.config({
  path: envPath,
})

import { datocmsRequest } from '../lib/datocms.js'
import { buildMenuTree } from '../lib/build-menu-tree.js'

import { findDeadLayerLinks } from '../lib/find-dead-layer-links.js'
import { filterDeadLayerLinks } from '../lib/filter-dead-layer-links.js'
import { getViewersPerContact } from '../lib/get-viewers-per-contact.js'

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    name
    deadLinksReportContacts {
      email
    }
    children: layers {
      id
      name
      url
      layer
    }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}`

async function report() {
  try {
    const { menus } = await datocmsRequest({
      query: viewersWithLayersQuery,
    })

    const menuTree = buildMenuTree(menus)

    const deadLayerLinks = await findDeadLayerLinks(menuTree)

    const filteredDeadLayerLinks = filterDeadLayerLinks(deadLayerLinks)  

    console.log(JSON.stringify(filteredDeadLayerLinks))
  } catch (err) {
    console.error(err)
  }
}

report()
