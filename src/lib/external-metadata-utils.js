/**
 * Utility functions for working with external metadata from GeoNetwork
 */
import fetch from "node-fetch";

/**
 * Transform a GeoNetwork metadata URL to the API format
 * @param {string} sourceUrl - The original GeoNetwork metadata URL
 * @returns {string} - The transformed URL pointing to the API endpoint
 */
export function transformSourceUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  const baseUrl = url.origin;
  const uuid = sourceUrl.split("/").pop();
  const geonetworkPath = url.pathname.split("/").slice(0, 2).join("/");

  return `${baseUrl}${geonetworkPath}/srv/api/records/${uuid}`;
}

/**
 * Fetch XML metadata from an external GeoNetwork source
 * @param {string} sourceUrl - The original GeoNetwork metadata URL
 * @returns {Promise<string>} - The XML metadata as a string
 * @throws {Error} - If the fetch fails
 */
export async function fetchExternalMetadataXml(sourceUrl) {
  const transformedSource = transformSourceUrl(sourceUrl);
  const xmlUrl = `${transformedSource}/formatters/xml`;

  const xml = await fetch(xmlUrl, {
    method: "GET",
    headers: {
      Accept: "application/xml",
      "Accept-Language": "en-US,en;q=0.5",
    },
  }).then((res) => {
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${xmlUrl} with status ${res.status}`
      );
    }
    return res.text();
  });

  return xml;
}
