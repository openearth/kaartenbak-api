import path, { dirname } from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { formatMenusRecursive } from "../lib/format-menu.js";
import { datocmsRequest } from "../lib/datocms.js";
import { buildMenuTree } from "../lib/build-menu-tree.js";
import { Geonetwork } from "../lib/geonetwork.js";
import { transform } from "../lib/xml-transformer.js";
import {
  initializeMailjet,
  sendErrorEmails,
} from "../lib/email-notifications.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = path.join(__dirname, "../../.env");

dotenv.config({
  path: envPath,
});

const mailjet = initializeMailjet();

export const instances = [
  {
    name: "nl2120",
    datoApiKey: process.env.DATO_API_KEY_NL2120,
  },
  // {
  //     name: "openearth-rws-viewer",
  //     datoApiKey: process.env.DATO_API_KEY_OPENEARTH_RWS_VIEWER,
  // },
];

const viewersWithLayersQuery = /* graphql */ `
query viewersWithLayers($first: IntType, $skip: IntType = 0, $locale: SiteLocale = en) {
  menus: allMenus(first: $first, skip: $skip, locale: $locale) {
    id
    name
    geonetwork {
      baseUrl
      username
      password
    }
    errorNotificationContacts {
      email
    }
    children: viewerLayers {
      id
      layer {
        thumbnails {
          url
        }
        id
        name
        url
      }
      links {
        ... on MetadataLinkRecord {
            id
            url
            protocol
            name
            description
        }   
      }
      externalMetadata
    }
    parent {
      id
    }
  }
  _allMenusMeta {
    count
  }
}
`;

const findExternalMetadata = (menuTree) => {
  const externalMetadatas = [];
  let currentGeonetwork = null;

  function findInMenu(children) {
    for (const child of children) {
      const {
        geonetwork,
        externalMetadata,
        children,
        thumbnails,
        name,
        links,
        id,
      } = child;

      if (geonetwork) {
        currentGeonetwork = geonetwork;
      }

      if (externalMetadata) {
        externalMetadatas.push({
          sourceUrl: externalMetadata,
          destination: {
            geonetwork: currentGeonetwork,
          },
          metadata: {
            id,
            thumbnails:
              thumbnails?.map((thumbnail) => {
                return {
                  url: thumbnail.url,
                  filename: `Kaarttitel: ${name}`,
                };
              }) || [],
            links: links || [],
          },
        });
      }

      if (children) {
        findInMenu(children);
      }
    }
  }

  findInMenu(menuTree);

  return externalMetadatas;
};

const syncExternalMetadata = async (externalMetadatas) => {
  for (const externalMetadata of externalMetadatas) {
    const { sourceUrl, destination } = externalMetadata;
    const geoNetworkUrl =
      destination.geonetwork.baseUrl + "/geonetwork/srv/api";

    const transformedSource = transformSourceUrl(sourceUrl);

    try {
      const geonetwork = new Geonetwork(
        geoNetworkUrl,
        destination.geonetwork.username,
        destination.geonetwork.password
      );

      const xml = await fetch(`${transformedSource}/formatters/xml`).then(
        (res) => res.text()
      );

      // Use the chainable transformer
      const transformedXml = transform(xml)
        .addThumbnails(externalMetadata.metadata.thumbnails)
        .addLinks(externalMetadata.metadata.links)
        .replaceId(externalMetadata.metadata.id)
        .getXml();

      await geonetwork.recordsRequest({
        method: "PUT",
        params: {
          metadataType: "METADATA",
          uuidProcessing: "OVERWRITE",
          publishToAll: "true",
        },
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/xml",
        },
        body: transformedXml,
      });
    } catch (error) {
      throw new Error(
        `Error syncing external metadata for ${transformedSource} to ${destination.geonetwork.baseUrl}:`,
        error
      );
    }

    console.log("Sync completed:");
    console.log(`  Source: ${transformedSource}`);
    console.log(`  Destination: ${destination.geonetwork.baseUrl}`);
    console.log(`  Record ID: ${externalMetadata.metadata.id}`);
  }
};

const transformSourceUrl = (sourceUrl) => {
  const url = new URL(sourceUrl);
  const baseUrl = url.origin;
  const uuid = sourceUrl.split("/").pop();

  return `${baseUrl}/geonetwork/srv/api/records/${uuid}`;
};

async function sync() {
  for (const instance of instances) {
    try {
      console.log(`Starting sync for ${instance.name}...`);

      const { menus } = await datocmsRequest({
        query: viewersWithLayersQuery,
        token: instance.datoApiKey,
      });

      const formattedMenus = formatMenusRecursive(menus);
      const menuTree = buildMenuTree(formattedMenus);
      const externalMetadatas = findExternalMetadata(menuTree);

      await syncExternalMetadata(externalMetadatas);

      console.log(
        `Synced ${externalMetadatas.length} external metadata instances for ${instance.name}`
      );
    } catch (error) {
      console.error(`Error during sync for ${instance.name}:`, error);

      try {
        // Get menus again to find error notification contacts
        const { menus } = await datocmsRequest({
          query: viewersWithLayersQuery,
          token: instance.datoApiKey,
          environment: "data-harvest-test-environment",
        });

        const formattedMenus = formatMenusRecursive(menus);
        const menuTree = buildMenuTree(formattedMenus);

        await sendErrorEmails(menuTree, instance.name, error, mailjet);
      } catch (emailError) {
        console.error("Error sending notification emails:", emailError);
      }
    }
  }
}

sync();
