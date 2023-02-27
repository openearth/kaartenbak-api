import dotenv from 'dotenv'
dotenv.config({
  path: '../../.env',
})

import { datocmsRequest } from '../lib/datocms.js'
import { buildMenuTree } from '../lib/build-menu-tree.js'

import { findDeadLayerLinks } from '../lib/find-dead-layer-links.js'
import { filterDeadLayerLinks } from '../lib/filter-dead-layer-links.js'

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

import { spawn } from 'child_process'

function pbcopy(data) {
  var proc = spawn('pbcopy')
  proc.stdin.write(data)
  proc.stdin.end()
}

// import deadLayerLinks from './links.json' assert { type: 'json' }

function getViewersPerContact(menuTree) {
  const contacts = []

  
}

async function report() {
  const { menus } = await datocmsRequest({
    query: viewersWithLayersQuery,
  })

  const menuTree = buildMenuTree(menus)

  console.log(menuTree)

  // const deadLayerLinks = await findDeadLayerLinks(menuTree)

  // console.dir(filterDeadLayerLinks(deadLayerLinks), { depth: null })

  // pbcopy(JSON.stringify(filterDeadLayerLinks(deadLayerLinks)))
}

report()
