const { datocmsRequest } = require('../lib/datocms')

const query = /* graphql */ `
query FactsheetById($id: ItemId) {
  factsheet(filter: {id: {eq: $id}}) {
    id
    title
    urlOriginalFile
    metadataCitationTitle
    metadataCitationDateDate
    metadataCitationDateDatetype
    metadataAbstract
    metadataDescriptivekeywordsKeywords {
      title
    }
    metadataSpatialresolutionEquivalentscaleDenominator
    metadataReferencesystemidentifierCode
  }
}
`

const formatInspire = (item) => /* xml */ `
<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco" xmlns:gmx="http://www.isotc211.org/2005/gmx" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:schemaLocation="http://www.isotc211.org/2005/gmd http://schemas.opengis.net/csw/2.0.2/profiles/apiso/1.0.0/apiso.xsd">
<!-- TG Recommendation C.1: metadata/2.0/rec/common/fileIdentifier: The metadata record should contain a globally unique and persistent fileIdentifier element. -->
  <gmd:fileIdentifier>
    <gco:CharacterString>123e4567-e89b-12d3-a456-426655440000</gco:CharacterString>
  </gmd:fileIdentifier>
  <!-- TG Requirement C.5: metadata/2.0/req/common/metadata-language-code: The language of the provided metadata content shall be given. It shall be encoded using gmd:MD_Metadata/gmd:language/gmd:LanguageCode element pointing to one of the three-letter language codes of the ISO 639-2/B code list. Only the code values for the official languages of the European Union shall be used. The multiplicity of this element is 1. -->
  <gmd:language>
    <gmd:LanguageCode codeList="http://www.loc.gov/standards/iso639-2/" codeListValue="ned"/>
  </gmd:language>
  <gmd:characterSet>
    <gmd:MD_CharacterSetCode codeListValue="utf8" codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_CharacterSetCode">UTF-8</gmd:MD_CharacterSetCode>
  </gmd:characterSet>
  <!-- TG Requirement 1.1: metadata/2.0/req/datasets-and-series/resource-type: The resource type shall be declared as "dataset" or "series" using the first gmd:hierarchyLevel child element of gmd:MD_Metadata. The gmd:hierarchyLevel shall contain a gmd:MD_ScopeCode element. -->
  <gmd:hierarchyLevel>
    <gmd:MD_ScopeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset"/>
  </gmd:hierarchyLevel>
  <!-- TG Requirement 1.2: metadata/2.0/req/datasets-and-series/only-one-md-data-identification: The first gmd:identificationInfo property of gmd:MD_Metadata element shall contain only one gmd:MD_DataIdentification element for identifying the described INSPIRE data set or data set series. -->
  <gmd:identificationInfo>
  <gmd:MD_DataIdentification>
    <!-- TG Requirement C.8: metadata/2.0/req/common/resource-title: A human readable, non-empty title of the described data set, data set series or service shall be provided. It shall be encoded using the gmd:citation/gmd:CI_Citation/gmd:title element with a Non-empty Free Text Element content in the language of the metadata. The multiplicity of the element is 1. -->
    <!-- TG Requirement C.11: metadata/2.0/req/common/temporal-reference: At least one temporal reference describing the resource shall be given using gmd:citation/gmd:CI_Citation/gmd:date/gmd:CI_Date/gmd:date element, with one of the following date types: - publication for date of publication of the resource, - revision for the date of last revision of the resource, or - creation for the date of creation of the resource.
The date type shall be given using the gmd:citation/gmd:CI_Citation/gmd:date/gmd:CI_Date/gmd:dateType/gmd:CI_DateTypeCode element and it shall point to the corresponding value of [ISO 19139] code list CI_DateTypeCode mentioned above.
The date values shall be expressed using Gregorian calendar and in accordance with [ISO 8601] with either date precision or date and time precision. For date precision the gmd:CI_Date/gmd:date/gco:Date element, and for date and time precision gmd:CI_Date/gmd:date/gco:DateTime element shall be used. -->
    <!-- TG Requirement C.12: metadata/2.0/req/common/max-1-date-of-creation: Not more than one date of creation for the described resource shall be given. -->
    <!-- TG Requirement C.13: metadata/2.0/req/common/max-1-date-of-last-revision: Not more than one date of last revision for the described resource shall be given. -->
    <gmd:citation>
      <gmd:CI_Citation>
        <gmd:title>
          <gco:CharacterString>${
            item.metadataCitationTitle
          }</gco:CharacterString>
        </gmd:title>
        <gmd:date>
          <gmd:CI_Date>
            <gmd:date>
              <gco:Date>${item.metadataCitationDateDate}</gco:Date>
            </gmd:date>
            <gmd:dateType>
              <gmd:CI_DateTypeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#CI_DateTypeCode" codeListValue="${
                item.metadataCitationDateDatetype
              }">
              ${
                {
                  creation: 'Creation',
                  publication: 'Publication',
                  revision: 'Revision',
                }[item.metadataCitationDateDatetype]
              }
            </gmd:CI_DateTypeCode>
            </gmd:dateType>
          </gmd:CI_Date>
        </gmd:date>
        <!-- TG Requirement 1.3: metadata/2.0/req/datasets-and-series/dataset-uid: A unique identifier shall be given for each described dataset or data sets series. This identifier shall be a URI consisting of a namespace uniquely identifying a naming context governed by an identifier authority, and a code unique within this namespace.
The identifying URI shall be encoded using gmd:citation/gmd:CI_Citation/gmd:identifier/*/gmd:code element with a Non-empty Free Text Element content.
The multiplicity of this element is 1..*. -->
        <gmd:identifier>
          <gmd:MD_Identifier>
            <gmd:code>
              <gmx:Anchor xlink:href="http://www.my-organisation.eu/so/lu/land-use-map">http://www.my-organisation.eu/so/lu/land-use-map</gmx:Anchor>
              <!--  if the identifier is not an HTTP URI, the use of <gco:CharacterString> is also possible  -->
            </gmd:code>
          </gmd:MD_Identifier>
        </gmd:identifier>
      </gmd:CI_Citation>
    </gmd:citation>
    <!-- TG Requirement C.9: metadata/2.0/req/common/resource-abstract: A non-empty brief narrative summary of the content of the described data set, data set series or service shall be provided. It shall be encoded using the gmd:abstract element with a Non-empty Free Text Element content in the language of the metadata. The multiplicity of this element is 1. -->
    <gmd:abstract>
      <gco:CharacterString>${item.metadataAbstract}</gco:CharacterString>
    </gmd:abstract>
    <!-- TG Requirement C.15: metadata/2.0/req/common/keyword-originating-cv: When using keywords originating from a controlled vocabulary, the originating controlled vocabulary shall be cited using gmd:descriptiveKeywords/gmd:MD_Keywords/gmd:thesaurusName/gmd:CI_Citation element.
    The title of the vocabulary shall be given using gmd:title element with a Non-empty Free Text Element content.
    The publication date of the vocabulary shall be given using the gmd:date/gmd:CI_Date/gmd:date/gco:Date and gmd:dateType/gmd:CI_DateTypeCode elements. -->
    <!-- TG Requirement 1.4: metadata/2.0/req/datasets-and-series/inspire-theme-keyword: The INSPIRE Spatial Data Theme(s), to which the data set belongs to, shall be declared using at least one keyword from the INSPIRE Spatial Data Themes vocabulary of the general environmental multilingual thesaurus (GEMET). The keyword values shall be the exact text values of the terms in this vocabulary.
    These keywords shall be encoded using an gmd:descriptiveKeywords/gmd:MD_Keywords element referring to the GEMET INSPIRE themes controlled vocabulary as specified in section 2.4.5. The value of the gmd:thesaurusName/gmd:CI_Citation/gmd:title element shall contain value "GEMET - INSPIRE themes, version 1.0".
    For each INSPIRE Spatial Data Theme, a gmd:keyword element shall be included with -->
    <gmd:descriptiveKeywords>
      <gmd:MD_Keywords>
        ${item.metadataDescriptivekeywordsKeywords.map(
          (keyword) =>
            `<gmd:keyword>
              <gco:CharacterString>${keyword.title}</gco:CharacterString>
            </gmd:keyword>`
        ).join('')}
      </gmd:MD_Keywords>
    </gmd:descriptiveKeywords>
    <!-- TG Requirement 2.4: metadata/2.0/req/isdss/spatial-representation-type: The spatial representation type shall be given using element gmd:spatialRepresentationType/gmd:MD_SpatialRepresentationTypeCode referring to one of the values of ISO 19139 code list MD_SpatialRepresentationTypeCode and one of the code list values "vector", "grid", "tin" or “textTable”. Multiplicity of this element is 1..*. -->
    <gmd:spatialRepresentationType>
      <gmd:MD_SpatialRepresentationTypeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_SpatialRepresentationTypeCode" codeListValue="vector">Vector</gmd:MD_SpatialRepresentationTypeCode>
    </gmd:spatialRepresentationType>
    <!-- TG Requirement 1.5: metadata/2.0/req/datasets-and-series/spatial-resolution: Spatial resolution for data set or data set series shall be given using either equivalent scale or a resolution distance, provided that these have been specified for the described data sets. If both ways have been specified, only one of the ways shall be used.
    The spatial resolution as equivalent scale shall be encoded using gmd:spatialResolution/gmd:MD_Resolution/gmd:equivalentScale/gmd:MD_RepresentativeFraction/gmd:denominator/gco:Integer element.
    The spatial resolution as resolution distance shall be encoded using gmd:spatialResolution/gmd:MD_Resolution/gmd:distance/gco:Distance element.
    The multiplicity of this element is 0..n. -->
    <gmd:spatialResolution>
      <gmd:MD_Resolution>
        <gmd:equivalentScale>
          <gmd:MD_RepresentativeFraction>
            <gmd:denominator>
              <gco:Integer>${item.metadataSpatialresolutionEquivalentscaleDenominator}</gco:Integer>
            </gmd:denominator>
          </gmd:MD_RepresentativeFraction>
        </gmd:equivalentScale>
      </gmd:MD_Resolution>
    </gmd:spatialResolution>

    <!-- TG Requirement 2.1: metadata/2.0/req/isdss/crs: The coordinate reference system(s) used in the described data set or data set series shall be given using element gmd:referenceSystemInfo/gmd:MD_ReferenceSystem/gmd:referenceSystemIdentifier/gmd:RS_Identifier.
    The multiplicity of this element is 1..*.
    The gmd:code child element of gmd:RS_Identifier is mandatory. The gmd:codeSpace child element shall be used if the code alone does not uniquely identify the referred coordinate reference system. Both gmd:code and gmd:codeSpace element (if given) shall contain Non-empty Free Text Elements.
    Only the coordinate reference system identifiers specified in a well-known common register shall be used. -->
    <!-- TG Requirement 2.2: metadata/2.0/req/isdss/crs-id: If the coordinate reference system is listed in the table Default Coordinate Reference System Identifiers in Annex D.4, the value of the HTTP URI Identifier column shall be used as the value of gmd:referenceSystemInfo/gmd:MD_ReferenceSystem/ gmd:referenceSystemIdentifier/gmd:RS_Identifier/gmd:code element.
    The gmd:codeSpace element shall not be used in this case. -->
    <gmd:referenceSystemInfo>
      <gmd:MD_ReferenceSystem>
        <gmd:referenceSystemIdentifier>
          <gmd:RS_Identifier>
            <gmd:code>
              <gco:CharacterString>${item.metadataAbstract}</gco:CharacterString>
            </gmd:code>
          </gmd:RS_Identifier>
        </gmd:referenceSystemIdentifier>
      </gmd:MD_ReferenceSystem>
    </gmd:referenceSystemInfo>

  </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
</gmd:MD_Metadata> 
  `

exports.handler = async (event, context) => {
  const { id } = event.queryStringParameters

  if (!id) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'id query parameter is required' }),
    }
  }

  try {
    const data = await datocmsRequest({ query, variables: { id } })
    console.log(data)
    const xml = formatInspire(data.factsheet)
    return {
      statusCode: 200,
      body: xml,
      headers: {
        'content-type': 'application/xml',
      },
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed fetching data' }),
    }
  }
}
