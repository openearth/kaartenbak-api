import path, { dirname } from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import Mailjet from 'node-mailjet'
import { formatMenusRecursive } from '../lib/format-menu'

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

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_TOKEN,
  apiSecret: process.env.MAILJET_API_SECRET,
})

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0) {
  menus: allMenus(first: $first, skip: $skip) {
    id
    name
    deadLinksReportContacts {
      email
    }
    children: viewerLayers {
      layer {
        id
        name
        url
        layer
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

async function report() {
  try {
    const { menus } = await datocmsRequest({
      query: viewersWithLayersQuery,
    })
    const formattedMenus = formatMenusRecursive(menus)

    const menuTree = buildMenuTree(formattedMenus)

    const deadLayerLinks = await findDeadLayerLinks(menuTree)

    const filteredDeadLayerLinks = filterDeadLayerLinks(deadLayerLinks)

    const viewersPerContact = getViewersPerContact(filteredDeadLayerLinks)

    for (const [email, viewers] of viewersPerContact) {
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_FROM_EMAIL,
            },
            To: [
              {
                Email: email,
              },
            ],
            Subject: 'Dode laagkaart links rapport',
            HTMLPart:
              '<p>Hallo,</p><p>Hierbij het dagelijkse rapport voor de dode laagkaart links.</p>',
            Attachments: [
              {
                ContentType: 'application/json',
                Filename: 'rapport.json',
                Base64Content: Buffer.from(JSON.stringify(viewers)).toString(
                  'base64'
                ),
              },
            ],
          },
        ],
      })
    }
  } catch (err) {
    console.error(err)
  }
}

report()
