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

  // Find the first graphicOverview tag to insert before existing thumbnails
  const firstGraphicOverviewIndex = xmlString.indexOf("<gmd:graphicOverview>");

  // If no existing thumbnails, find a suitable insertion point after descriptiveKeywords
  const insertAfterDescriptiveKeywords = xmlString.lastIndexOf(
    "</gmd:descriptiveKeywords>"
  );

  // Determine where to insert the new thumbnails
  let insertPoint;
  if (firstGraphicOverviewIndex !== -1) {
    // Insert before existing thumbnails
    insertPoint = firstGraphicOverviewIndex;
    // We'll insert directly at this position, without any trailing text
    var trailingText = "";
  } else if (insertAfterDescriptiveKeywords !== -1) {
    // No existing thumbnails, insert after descriptiveKeywords
    insertPoint =
      insertAfterDescriptiveKeywords + "</gmd:descriptiveKeywords>".length;
    // We'll insert at this position, without any leading text
    var trailingText = "";
  } else {
    console.error("Could not find a suitable place to insert thumbnails");
    return xmlString;
  }

  let thumbnailsXml = "";
  thumbnails.forEach((thumbnail) => {
    thumbnailsXml += `
<gmd:graphicOverview xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
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

  return (
    xmlString.slice(0, insertPoint) +
    thumbnailsXml +
    xmlString.slice(insertPoint)
  );
}
