export function formatLinks(links) {
  if (!links?.length) {
    return ''
  }

  return links.map(
    (link) => /* xml */ `
    <gmd:onLine>
      <gmd:CI_OnlineResource>
        <gmd:linkage>
          <gmd:URL>${link.url}</gmd:URL>
        </gmd:linkage>
        <gmd:protocol>
        <gco:CharacterString>${link.protocol}</gco:CharacterString>
        </gmd:protocol>
        <gmd:name>
          <gco:CharacterString>${link.name}</gco:CharacterString>
        </gmd:name>
        <gmd:description>
          <gco:CharacterString>${link.description}</gco:CharacterString>
        </gmd:description>
      </gmd:CI_OnlineResource>
    </gmd:onLine>
    `
  ).join('')
}
