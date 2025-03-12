/**
 * Adds thumbnails from a GraphQL query to an XML string
 * @param {string} xmlString - The XML string to add thumbnails to
 * @param {Array} thumbnails - Array of thumbnail objects from GraphQL query with filename and url properties
 * @returns {string} - The modified XML string with thumbnails added
 */
export function addThumbnailsToXml(xmlString, thumbnails) {
  if (!thumbnails || !thumbnails.length) {
    return xmlString;
  }

  // Always add thumbnails regardless of whether they already exist
  // Find a suitable insertion point - after descriptiveKeywords section
  const insertPoint = xmlString.lastIndexOf('</gmd:descriptiveKeywords>');
  if (insertPoint === -1) {
    console.error('Could not find a suitable place to insert thumbnails');
    return xmlString;
  }

  let thumbnailsXml = '';
  thumbnails.forEach(thumbnail => {
    thumbnailsXml += `
<gmd:graphicOverview>
  <gmd:MD_BrowseGraphic>
    <gmd:fileName>
      <gco:CharacterString>${thumbnail.url}</gco:CharacterString>
    </gmd:fileName>
    <gmd:fileDescription>
      <gco:CharacterString>${thumbnail.filename}</gco:CharacterString>
    </gmd:fileDescription>
  </gmd:MD_BrowseGraphic>
</gmd:graphicOverview>`;
  });

  return xmlString.slice(0, insertPoint + '</gmd:descriptiveKeywords>'.length) +
    thumbnailsXml +
    xmlString.slice(insertPoint + '</gmd:descriptiveKeywords>'.length);
} 