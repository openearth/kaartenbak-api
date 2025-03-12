import { formatLinks } from './format-links.js';

/**
 * Adds links from a GraphQL query to an XML string
 * @param {string} xmlString - The XML string to add links to
 * @param {Array} links - Array of link objects from GraphQL query with url, protocol, name, and description properties
 * @returns {string} - The modified XML string with links added
 */
export function addLinksToXml(xmlString, links) {
    if (!links || !links.length) {
        return xmlString;
    }

    // Find the insertion point - inside the MD_DigitalTransferOptions section
    const insertPoint = xmlString.lastIndexOf('</gmd:MD_DigitalTransferOptions>');
    if (insertPoint === -1) {
        console.error('Could not find a suitable place to insert links');
        return xmlString;
    }

    // Format the links using the formatLinks function
    const linksXml = formatLinks(links);

    // Insert the links before the closing MD_DigitalTransferOptions tag
    return xmlString.slice(0, insertPoint) +
        linksXml +
        xmlString.slice(insertPoint);
} 