export function formatSpatialRepresentationType(layerInfo) {
  const keyword = layerInfo?.KeywordList?.Keyword[0]?._text?.toLowerCase()

  let representationType

  switch (keyword) {
    case 'features':
    case 'wfs':
      representationType = {
        type: 'Vector',
        value: 'vector',
      }
      break
    case 'wcs':
      representationType = {
        type: 'Raster',
        value: 'raster',
      }
  }

  if (!representationType) {
    return ''
  }

  return /* xml */ `<gmd:spatialRepresentationType>
  <gmd:MD_SpatialRepresentationTypeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_SpatialRepresentationTypeCode" codeListValue="${representationType.value}">${representationType.type}</gmd:MD_SpatialRepresentationTypeCode>
</gmd:spatialRepresentationType>`
}
