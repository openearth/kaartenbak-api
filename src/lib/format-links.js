import xmlEscape from "xml-escape";

export function formatLinks(links) {
  if (!links?.length) {
    return "";
  }

  return links
    .map(
      (link) => /* xml */ `
    <gmd:onLine xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
      <gmd:CI_OnlineResource>
        <gmd:linkage>
          <gmd:URL>${xmlEscape(link.url)}</gmd:URL>
        </gmd:linkage>
        <gmd:protocol>
        <gco:CharacterString>${link.protocol}</gco:CharacterString>
        </gmd:protocol>
        <gmd:name>
          <gco:CharacterString>
          <![CDATA[
            ${link.name}
          ]]>
          </gco:CharacterString>
        </gmd:name>
        <gmd:description>
          <gco:CharacterString>
          <![CDATA[
            ${link.description}
          ]]>
          </gco:CharacterString>
        </gmd:description>
      </gmd:CI_OnlineResource>
    </gmd:onLine>
    `
    )
    .join("");
}
