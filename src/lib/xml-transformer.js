/**
 * A chainable XML transformer utility
 */
import { formatLinks } from './format-links.js';
import { addThumbnailsToXml } from './add-thumbnails-to-xml.js';

export class XmlTransformer {
    /**
     * Create a new XML transformer
     * @param {string} xml - The XML string to transform
     */
    constructor(xml) {
        this.xml = xml;
    }

    /**
     * Add thumbnails to the XML
     * @param {Array} thumbnails - Array of thumbnail objects
     * @returns {XmlTransformer} - The transformer instance for chaining
     */
    addThumbnails(thumbnails) {
        if (!thumbnails || !thumbnails.length) {
            return this;
        }

        this.xml = addThumbnailsToXml(this.xml, thumbnails);

        return this;
    }

    /**
     * Add links to the XML
     * @param {Array} links - Array of link objects
     * @returns {XmlTransformer} - The transformer instance for chaining
     */
    addLinks(links) {
        if (!links || !links.length) {
            return this;
        }

        // Find the insertion point - inside the MD_DigitalTransferOptions section
        const insertPoint = this.xml.lastIndexOf('</gmd:MD_DigitalTransferOptions>');
        if (insertPoint === -1) {
            console.error('Could not find a suitable place to insert links');
            return this;
        }

        // Format the links using the formatLinks function
        const linksXml = formatLinks(links);

        // Insert the links before the closing MD_DigitalTransferOptions tag
        this.xml = this.xml.slice(0, insertPoint) +
            linksXml +
            this.xml.slice(insertPoint);

        return this;
    }

    /**
     * Get the transformed XML
     * @returns {string} - The transformed XML string
     */
    getXml() {
        return this.xml;
    }

    /**
     * Replace the file identifier in the XML
     * @param {string} id - The new identifier to use
     * @returns {XmlTransformer} - The transformer instance for chaining
     */
    replaceId(id) {
        // Find the fileIdentifier element and replace it with the new ID
        // The pattern matches the entire fileIdentifier element including the CharacterString inside
        this.xml = this.xml.replace(
            /<gmd:fileIdentifier>[\s\S]*?<gco:CharacterString>.*?<\/gco:CharacterString>[\s\S]*?<\/gmd:fileIdentifier>/,
            `<gmd:fileIdentifier>\n    <gco:CharacterString>${id}</gco:CharacterString>\n  </gmd:fileIdentifier>`
        );

        return this;
    }
}

/**
 * Create a new XML transformer
 * @param {string} xml - The XML string to transform
 * @returns {XmlTransformer} - A new transformer instance
 */
export function transform(xml) {
    return new XmlTransformer(xml);
} 