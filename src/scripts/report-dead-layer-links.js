import path, { dirname } from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { formatMenusRecursive } from '../lib/format-menu'
import { initializeMailjet, sendEmail, findEmailContacts } from '../lib/email-notifications.js'

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

const mailjet = initializeMailjet()

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers ($first: IntType, $skip: IntType = 0, $locale: SiteLocale = nl) {
  menus: allMenus(first: $first, skip: $skip, locale: $locale) {
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
      const subject = 'Dode laagkaart links rapport'
      const htmlContent = '<p>Hallo,</p><p>Hierbij het dagelijkse rapport voor de dode laagkaart links.</p>'
      const attachments = [
        {
          ContentType: 'application/json',
          Filename: 'rapport.json',
          Base64Content: Buffer.from(JSON.stringify(viewers)).toString('base64'),
        },
      ]

      try {
        await sendEmail(email, subject, htmlContent, mailjet, process.env.MAILJET_FROM_EMAIL, attachments)
        console.log(`Successfully sent dead layer links report to ${email}`)
      } catch (err) {
        console.error(`Failed to send dead layer links report to ${email}:`, err)
      }
    }
  } catch (err) {
    console.error(err)
  }
}

report()
