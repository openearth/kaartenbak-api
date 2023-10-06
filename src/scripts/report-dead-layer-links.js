import path, { dirname } from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import Mailjet from 'node-mailjet'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = path.join(__dirname, '../../.env')

dotenv.config({
  path: envPath,
})

import { datocmsRequest } from '../lib/datocms.js'
import { buildMenuTree } from '../lib/build-menu-tree.js'

import { getViewerAndLayers } from '../lib/find-dead-layer-links.js'
import { getWmsCapabilities } from '../lib/get-capabilities.js'

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

function timeout(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function report() {
  try {
    const { menus } = await datocmsRequest({
      query: viewersWithLayersQuery,
    })

    const menuTree = buildMenuTree(menus)

    const checkedUrls = new Set()
    const reportsPerEmail = {}

    for(let {viewer, layers} of getViewerAndLayers(menuTree)) {
      const deadLayers = []

      for(let layer of layers) {
        // url was already checked skip it
        if(checkedUrls.has(layer.url)) {
          console.log(`Already checked ${layer.id} so skipping...`)
          continue
        }
  
        checkedUrls.add(layer.url)

        console.log(`Checking ${layer.id}...`)

        const { linkIsDead } = await getWmsCapabilities(
          layer.url
        )
  
        if(linkIsDead) {
          console.log(`${layer.url} is unreachable...`)
          deadLayers.push(layer)
          break
        }
      }

      if(!deadLayers.length) {
        continue
      }

      /**
       * Group the reports by email so that it looks something like this:
       * 
       * {
       *    "admin@deltares.nl": {
       *       "viewerName": [
       *        deadLayer1,
       *        deadLayer2
       *      ]
       *    }
       * }
       * 
       */
      for(let { email } of viewer.deadLinksReportContacts) {
        if(!reportsPerEmail[email]) {
          reportsPerEmail[email] = {}
        }

        if(!reportsPerEmail[email][viewer.name]) {
          reportsPerEmail[email][viewer.name] = []
        }

        reportsPerEmail[email][viewer.name].push(...deadLayers)
      }
      

      await timeout(2000) // TODO tweak this timeout
    }

    for (const [email, viewers] of Object.entries(reportsPerEmail)) {
      console.log(`Sending email to ${email}`)

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
  }
  catch (err) {
    console.error(err)
  }
}

report()
