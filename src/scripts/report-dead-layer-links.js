import dotenv from 'dotenv'
dotenv.config({
  path: '../../.env',
})

import { datocmsRequest } from '../lib/datocms.js'

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    children: layers {
      id
      url
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
  const test = await datocmsRequest({
    query: viewersWithLayersQuery,
  })

  console.log(test)
}

report()
