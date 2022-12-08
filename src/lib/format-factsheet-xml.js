const { dateTypes } = require('./constants')
const { formatKeywords } = require('./format-keywords')
const {
  formatSpatialRepresentationType,
} = require('./format-spatial-representation-type')
const { formatLinks } = require('./format-links')

export const format = ({ id, layerInfo, layer, factsheet }) => /* xml */ `
<gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco" xmlns:gmx="http://www.isotc211.org/2005/gmx" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:schemaLocation="http://www.isotc211.org/2005/gmd http://schemas.opengis.net/csw/2.0.2/profiles/apiso/1.0.0/apiso.xsd">
<!-- TG Recommendation C.1: metadata/2.0/rec/common/fileIdentifier: The metadata record should contain a globally unique and persistent fileIdentifier element. -->
  <gmd:fileIdentifier>
    <gco:CharacterString>${id}</gco:CharacterString>
  </gmd:fileIdentifier>
  <!-- TG Requirement C.5: metadata/2.0/req/common/metadata-language-code: The language of the provided metadata content shall be given. It shall be encoded using gmd:MD_Metadata/gmd:language/gmd:LanguageCode element pointing to one of the three-letter language codes of the ISO 639-2/B code list. Only the code values for the official languages of the European Union shall be used. The multiplicity of this element is 1. -->
  <gmd:language>
    <gmd:LanguageCode codeList="http://www.loc.gov/standards/iso639-2/" codeListValue="dut"/>
  </gmd:language>
  <gmd:characterSet>
    <gmd:MD_CharacterSetCode codeListValue="utf8" codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_CharacterSetCode">UTF-8</gmd:MD_CharacterSetCode>
  </gmd:characterSet>
  <!-- TG Requirement 1.1: metadata/2.0/req/datasets-and-series/resource-type: The resource type shall be declared as "dataset" or "series" using the first gmd:hierarchyLevel child element of gmd:MD_Metadata. The gmd:hierarchyLevel shall contain a gmd:MD_ScopeCode element. -->
  <gmd:hierarchyLevel>
    <gmd:MD_ScopeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_ScopeCode" codeListValue="${
      factsheet.hierarchieniveau
    }"/>
  </gmd:hierarchyLevel>
  <!-- TG Requirement C.6: metadata/2.0/req/common/md-point-of-contact: Point of contact for the responsible party for the provided metadata shall be given using element gmd:MD_metadata/gmd:contact/gmd:CI_ResponsibleParty. The multiplicity of this element is 1..*. The gmd:CI_ResponsibleParty element shall contain the following child elements: The name of the responsible organisation shall be provided as the value of gmd:organisationName element with a Non-empty Free Text Element content. The email address of the organisation shall be provided as the value of gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress element with a Non-empty Free Text Element containing a functioning email address of the responsible party. The value of gmd:role/gmd:CI_RoleCode shall point to the value "pointOfContact" of [ISO 19139] code list CI_RoleCode. -->
  <gmd:contact>
    <gmd:CI_ResponsibleParty>
      <gmd:organisationName>
        <gco:CharacterString>Deltares</gco:CharacterString>
      </gmd:organisationName>
      <gmd:contactInfo>
        <gmd:CI_Contact>
          <gmd:address>
            <gmd:CI_Address>
              <gmd:electronicMailAddress>
                <gco:CharacterString>deltaresdata@deltares.nl</gco:CharacterString>
              </gmd:electronicMailAddress>
            </gmd:CI_Address>
          </gmd:address>
        </gmd:CI_Contact>
      </gmd:contactInfo>
      <gmd:role>
        <gmd:CI_RoleCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact" />
      </gmd:role>
    </gmd:CI_ResponsibleParty>
  </gmd:contact>
  <!-- TG Requirement C.7: metadata/2.0/req/common/md-date: The latest update date of the metadata description shall be given for each metadata record. It shall be encoded using the gmd:MD_Metadata/gmd:dateStamp element. If no updates to the metadata have been made since publishing it, the creation date of the metadata shall be used instead. The multiplicity of this element is 1. -->
  
  <gmd:dateStamp>
    <gco:Date>${factsheet._updatedAt.split('T')[0]}</gco:Date>
  <!--  To also specify the time zone (optional), the value would be e.g. 2019-05-15T09:00:00+02:00  -->
  </gmd:dateStamp>

  <gmd:metadataStandardName>
    <gco:CharacterString>ISO 19115</gco:CharacterString>
  </gmd:metadataStandardName>

  <gmd:metadataStandardVersion>
    <gco:CharacterString>Nederlands metadata profiel op ISO 19115 voor geografie 2.0</gco:CharacterString>
  </gmd:metadataStandardVersion>

  ${
    layerInfo
      ? /* xml */ `
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
            <gmx:Anchor xlink:href="http://www.opengis.net/def/crs/EPSG/0/${
              layerInfo.CRS[0]._text.split(':')[1]
            }">${layerInfo.CRS[0]._text}</gmx:Anchor>
          </gmd:code>
        </gmd:RS_Identifier>
      </gmd:referenceSystemIdentifier>
    </gmd:MD_ReferenceSystem>
  </gmd:referenceSystemInfo>
  `
      : ''
  }

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
            <gco:CharacterString>${layer.name}</gco:CharacterString>
          </gmd:title>
          <gmd:date>
            <gmd:CI_Date>
              <gmd:date>
                <gco:Date>${factsheet.datumVanDeBron}</gco:Date>
              </gmd:date>
              <gmd:dateType>
                <gmd:CI_DateTypeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#CI_DateTypeCode" codeListValue="${
                  factsheet.datumtypeVanDeBron
                }">
                ${dateTypes[factsheet.datumtypeVanDeBron]}
              </gmd:CI_DateTypeCode>
              </gmd:dateType>
            </gmd:CI_Date>
          </gmd:date>
        </gmd:CI_Citation>
      </gmd:citation>
      <!-- TG Requirement C.9: metadata/2.0/req/common/resource-abstract: A non-empty brief narrative summary of the content of the described data set, data set series or service shall be provided. It shall be encoded using the gmd:abstract element with a Non-empty Free Text Element content in the language of the metadata. The multiplicity of this element is 1. -->
      <gmd:abstract>
        <gco:CharacterString>${factsheet.samenvatting}</gco:CharacterString>
      </gmd:abstract>

      <gmd:status>
        <gmd:MD_ProgressCode codeListValue="${
          factsheet.identificationinfoStatus
        }" codeList="https://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_ProgressCode"/>
      </gmd:status>
      <!-- TG Requirement C.10: metadata/2.0/req/common/responsible-organisation: The point of contact for the organisation responsible for the establishment, management, maintenance and distribution of the described resource shall be given using element gmd:pointOfContact/gmd:CI_ResponsibleParty. The multiplicity of this element is 1..*.
      The gmd:CI_ResponsibleParty element shall contain the following child elements: The name of the organisation shall be given as the value of gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:organisationName element with a Non-empty Free Text Element content.
      The email address of the organisation shall be provided as the value of gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress element with a Non-empty Free Text Element containing a functioning email address of the responsible party.
      The value of gmd:pointOfContact/gmd:CI_ResponsibleParty/gmd:role/gmd:CI_RoleCode shall point to the most relevant value of ISO 19139 code list CI_RoleCode. -->
      ${layer.pointOfContactOrganisations
        .map(
          (item) => /* xml */ `
      <gmd:pointOfContact>
        <gmd:CI_ResponsibleParty>
          <gmd:organisationName>
            <gco:CharacterString>${item.organisationName}</gco:CharacterString>
          </gmd:organisationName>
          <gmd:contactInfo>
            <gmd:CI_Contact>
              <gmd:address>
                <gmd:CI_Address>
                  <gmd:electronicMailAddress>
                    <gco:CharacterString>${item.email}</gco:CharacterString>
                  </gmd:electronicMailAddress>
                </gmd:CI_Address>
              </gmd:address>
            </gmd:CI_Contact>
          </gmd:contactInfo>
          <gmd:role>
            <gmd:CI_RoleCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#CI_RoleCode" codeListValue="${item.rol}" />
          </gmd:role>
        </gmd:CI_ResponsibleParty>
      </gmd:pointOfContact>
      `
        )
        .join(' ')}
      <!-- TG Requirement C.15: metadata/2.0/req/common/keyword-originating-cv: When using keywords originating from a controlled vocabulary, the originating controlled vocabulary shall be cited using gmd:descriptiveKeywords/gmd:MD_Keywords/gmd:thesaurusName/gmd:CI_Citation element.
      The title of the vocabulary shall be given using gmd:title element with a Non-empty Free Text Element content.
      The publication date of the vocabulary shall be given using the gmd:date/gmd:CI_Date/gmd:date/gco:Date and gmd:dateType/gmd:CI_DateTypeCode elements. -->
      <!-- TG Requirement 1.4: metadata/2.0/req/datasets-and-series/inspire-theme-keyword: The INSPIRE Spatial Data Theme(s), to which the data set belongs to, shall be declared using at least one keyword from the INSPIRE Spatial Data Themes vocabulary of the general environmental multilingual thesaurus (GEMET). The keyword values shall be the exact text values of the terms in this vocabulary.
      These keywords shall be encoded using an gmd:descriptiveKeywords/gmd:MD_Keywords element referring to the GEMET INSPIRE themes controlled vocabulary as specified in section 2.4.5. The value of the gmd:thesaurusName/gmd:CI_Citation/gmd:title element shall contain value "GEMET - INSPIRE themes, version 1.0".
      For each INSPIRE Spatial Data Theme, a gmd:keyword element shall be included with -->
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          ${factsheet.themas
            .map(
              (thema) =>
                `<gmd:keyword>
                  <gco:CharacterString>${thema.title}</gco:CharacterString>
                </gmd:keyword>`
            )
            .join('')}
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gmx:Anchor xlink:href="http://www.eionet.europa.eu/gemet/inspire_themes">GEMET - INSPIRE themes, version 1.0</gmx:Anchor>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2008-06-01</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#CI_DateTypeCode" codeListValue="publication">Publication</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <!-- TG Requirement C.18: metadata/2.0/req/common/conditions-for-access-and-use: Conditions for access and use of the described resource shall be described using exactly one gmd:resourceConstraints/gmd:MD_LegalConstraints element. This element shall not be the same used for describing limitations on public access (see 2.4.6).
      The gmd:resourceConstraints/gmd:MD_LegalConstraints element for conditions for access and use shall be encoded as follows:
      One instance of either gmd:accessConstraints or gmd:useConstraints element shall be given. In both cases this element shall contain a gmd:MD_RestrictionCode element with code list value "otherRestrictions".
      Additionally at least one instance of gmd:otherConstraints shall be given describing the actual conditions.
      If no conditions apply the gmd:otherConstraints shall include a gmx:Anchor element pointing to the value "noConditionsApply" in the code list ConditionsApplyingToAccessAndUse.
      If the conditions are unknown gmd:otherConstraints shall include a gmx:Anchor element pointing to the value "conditionsUnknown" in the code list ConditionsApplyingToAccessAndUse.
      In other cases gmd:otherConstraints shall include a Non-empty Free Text Element with a textual description of the conditions in the language of the metadata. This text shall include descriptions of terms and conditions, including where applicable, the corresponding fees or an URL pointing to an online resource where these terms and conditions are described. -->

      <gmd:resourceConstraints>
        <gmd:MD_LegalConstraints>
          <gmd:useConstraints>
            <gmd:MD_RestrictionCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_RestrictionCode" codeListValue="otherRestrictions"/>
          </gmd:useConstraints>
          <gmd:otherConstraints>
            <gmx:Anchor xlink:href="http://inspire.ec.europa.eu/metadata-codelist/ConditionsApplyingToAccessAndUse/noConditionsApply">Geen condities voor toegang en gebruik</gmx:Anchor>
          </gmd:otherConstraints>
        </gmd:MD_LegalConstraints>
      </gmd:resourceConstraints>
      <!-- TG Requirement C.17: metadata/2.0/req/common/limitations-on-public-access: Limitations on public access (or lack of such limitations) for the described resource shall be described using exactly one gmd:resourceConstraints/gmd:MD_LegalConstraints element. This element shall not be the same one as used for describing conditions applying to access and use (see 2.4.7).
      The limitations on public access (or lack of such limitations) based on reasons referred to in point (a) or in points (c) to (h) of Article 13(1) of INSPIRE Directive quoted above, the gmd:resourceConstraints/gmd:MD_LegalConstraints element shall include a combination of: - one instance of gmd:accessConstraints/gmd:MD_RestrictionCode element with code list value "otherRestrictions" and - at least one instance of gmd:otherConstraints/gmx:Anchor pointing to one of the values from the code list for LimitationsOnPublicAccess. If there are no limitations on public access, the element shall point to the code list value "noLimitations". -->
      <gmd:resourceConstraints>
        <gmd:MD_LegalConstraints>
          <gmd:accessConstraints>
            <gmd:MD_RestrictionCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_RestrictionCode" codeListValue="otherRestrictions"/>
          </gmd:accessConstraints>
          <gmd:otherConstraints>
            <gmx:Anchor xlink:href="http://inspire.ec.europa.eu/metadata-codelist/LimitationsOnPublicAccess/INSPIRE_Directive_Article13_1d">Public access to spatial data sets and services would adversely affect the confidentiality of commercial or industrial information, where such confidentiality is provided for by national or Community law to protect a legitimate economic interest, including the public interest in maintaining statistical confidentiality and tax secrecy.</gmx:Anchor>
          </gmd:otherConstraints>
        </gmd:MD_LegalConstraints>
      </gmd:resourceConstraints>

      <gmd:resourceConstraints>
        <gmd:MD_LegalConstraints>
          <gmd:useLimitation>
            <gco:CharacterString>${
              factsheet.gebruiksbeperkingen
            }</gco:CharacterString>
          </gmd:useLimitation>
        </gmd:MD_LegalConstraints>
      </gmd:resourceConstraints>
      <!-- TG Requirement 2.4: metadata/2.0/req/isdss/spatial-representation-type: The spatial representation type shall be given using element gmd:spatialRepresentationType/gmd:MD_SpatialRepresentationTypeCode referring to one of the values of ISO 19139 code list MD_SpatialRepresentationTypeCode and one of the code list values "vector", "grid", "tin" or “textTable”. Multiplicity of this element is 1..*. -->
      ${formatSpatialRepresentationType(layerInfo)}
      <!-- TG Requirement 1.5: metadata/2.0/req/datasets-and-series/spatial-resolution: Spatial resolution for data set or data set series shall be given using either equivalent scale or a resolution distance, provided that these have been specified for the described data sets. If both ways have been specified, only one of the ways shall be used.
      The spatial resolution as equivalent scale shall be encoded using gmd:spatialResolution/gmd:MD_Resolution/gmd:equivalentScale/gmd:MD_RepresentativeFraction/gmd:denominator/gco:Integer element.
      The spatial resolution as resolution distance shall be encoded using gmd:spatialResolution/gmd:MD_Resolution/gmd:distance/gco:Distance element.
      The multiplicity of this element is 0..n. -->
      <gmd:spatialResolution>
        <gmd:MD_Resolution>
          <gmd:equivalentScale>
            <gmd:MD_RepresentativeFraction>
              <gmd:denominator>
                <gco:Integer>${factsheet.toepassingsschaal}</gco:Integer>
              </gmd:denominator>
            </gmd:MD_RepresentativeFraction>
          </gmd:equivalentScale>
        </gmd:MD_Resolution>
      </gmd:spatialResolution>

      <!-- TG Requirement 1.6: metadata/2.0/req/datasets-and-series/resource-language: For data sets or data set series containing textual information, the language(s) used in the resource shall be given. The language(s) used shall be encoded using one or more gmd:language/gmd:LanguageCode elements pointing to one of the three-letter language codes of the ISO 639-2/B code list.
      The multiplicity of the gmd:language element is 1..*.
      If the described resource does not contain textual information expressed in a natural language the special code value "zxx" of the ISO 639-2/B reserved for "no linguistic content; not applicable" shall be used. -->
      <gmd:language>
        <gmd:LanguageCode codeList="http://www.loc.gov/standards/iso639-2/" codeListValue="dut">Dutch</gmd:LanguageCode>
      </gmd:language>

      ${factsheet.onderwerp[0]?.topicCategoryItem
        ?.map(
          (item) => `
        <gmd:topicCategory>
          <gmd:MD_TopicCategoryCode>${item}</gmd:MD_TopicCategoryCode>
        </gmd:topicCategory>
      `
        )
        .join('')}

      ${
        layerInfo
          ? /* xml */ `
          <gmd:extent>
            <gmd:EX_Extent>
              <!-- TG Requirement C.19: metadata/2.0/req/common/bounding-box: A minimal containing geographic bounding box of the data set or data set series shall be described. This bounding box shall be encoded using one or more gmd:extent/gmd:EX_Extent/gmd:geographicElement/gmd:EX_GeographicBoundingBox elements.
              The multiplicity of this element is 1..* for data sets and data set series, and 0..n for services.
              The bounding coordinate values for west and east bound longitudes and south and north bound latitudes shall be given in decimal degree values using WGS 84 Coordinate Reference System, as specified for the EX_GeographicBoundingBox class of the [ISO 19115] data model. The coordinates shall be given with at least 2 decimal precision. -->
              <gmd:geographicElement>
                <gmd:EX_GeographicBoundingBox>
                  <gmd:westBoundLongitude>
                    <gco:Decimal>${layerInfo.EX_GeographicBoundingBox.westBoundLongitude._text}</gco:Decimal>
                  </gmd:westBoundLongitude>
                  <gmd:eastBoundLongitude>
                    <gco:Decimal>${layerInfo.EX_GeographicBoundingBox.eastBoundLongitude._text}</gco:Decimal>
                  </gmd:eastBoundLongitude>
                  <gmd:southBoundLatitude>
                    <gco:Decimal>${layerInfo.EX_GeographicBoundingBox.southBoundLatitude._text}</gco:Decimal>
                  </gmd:southBoundLatitude>
                  <gmd:northBoundLatitude>
                    <gco:Decimal>${layerInfo.EX_GeographicBoundingBox.northBoundLatitude._text}</gco:Decimal>
                  </gmd:northBoundLatitude>
                </gmd:EX_GeographicBoundingBox>
              </gmd:geographicElement>
            </gmd:EX_Extent>
          </gmd:extent>
      `
          : ''
      }
      <gmd:supplementalInformation>
        <gco:CharacterString>${factsheet.titelNaamMeetMonitorprogramma} - ${
  factsheet.urlOriginalFile
} - ${factsheet.naamAansturendeOrganisatie} - ${factsheet.datumVoltooiing} - ${
  factsheet.doelWaarvoorDataWordenVerzameld
} - ${factsheet.rolContactpersoon} - ${factsheet.geografischGebied} - ${
  factsheet.overigeBeperkingenInGebruik
} - ${factsheet.temporeleDekking} - ${factsheet.volledigheid} - ${
  factsheet.nauwkeurigheid
} - ${factsheet.inwinningsmethode} - ${
  factsheet.beschrijvingUitgevoerdeBewerkingen
} - ${factsheet.meetvariabelen} - ${factsheet.meetmethodiek} - ${
  factsheet.soortDataset
} - ${factsheet.kostenOpJaarbasis} - ${factsheet.soortenoverzicht} - ${
  factsheet.habitats
} - ${formatKeywords(layer.indexableWfsProperties)}</gco:CharacterString>
      </gmd:supplementalInformation>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmd:distributionInfo>
    <gmd:MD_Distribution>
      <!-- TG Requirement 2.6: metadata/2.0/req/isdss/data-encoding: The encoding and the storage or transmission format of the provided data sets or data set series shall be given using the gmd:distributionFormat/gmd:MD_Format element.
      The multiplicity of this element is 1..*.
      The gmd:name and gmd:version child elements of gmd:MD_Format are mandatory. Both of these elements shall contain Non-empty Free Text Elements.
      If the version of the encoding is unknown or if the encoding is not versioned, the gmd:version shall be left empty and the nil reason attribute shall be provided with either value "unknown" or "inapplicable" correspondingly. -->
      <gmd:distributionFormat>
        <gmd:MD_Format>
          <gmd:name>
            <gmx:Anchor xlink:href="https://www.iana.org/assignments/media-types/application/gml+xml">gml+xml</gmx:Anchor>
          </gmd:name>
          <gmd:version>
            <gco:CharacterString>3.2.1</gco:CharacterString>
          </gmd:version>
        </gmd:MD_Format>
      </gmd:distributionFormat>
      <!-- TG Requirement 1.8: metadata/2.0/req/datasets-and-series/resource-locator: A Resource locator linking to the service(s) providing online access to the described data set or data set series shall be given, if such online access is available.
      If no online access for the data set or data set series is available, but there is a publicly available online resource providing additional information about the described data set or data set series, the URL pointing to this resource shall be given instead.
      These links shall be encoded using gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/gmd:CI_OnlineResource/gmd: linkage/gmd:URL element.
      The multiplicity of this element is 0..n. -->
      <gmd:transferOptions>
        <gmd:MD_DigitalTransferOptions>
          ${formatLinks(layer.links)}
        </gmd:MD_DigitalTransferOptions>
      </gmd:transferOptions>
    </gmd:MD_Distribution>
  </gmd:distributionInfo>  
  <!-- TG Requirement 1.9: metadata/2.0/req/datasets-and-series/one-data-quality-element: There shall be exactly one gmd:dataQualityInfo/gmd:DQ_DataQuality element scoped to the entire described data set or data set series. The scoping shall be encoded using gmd:scope/gmd:DQ_Scope/gmd:level/gmd:MD_ScopeCode element referring to value "dataset" or "series" of ISO 19139 code list MD_ScopeCode. -->
  <gmd:dataQualityInfo>
    <gmd:DQ_DataQuality>
    <gmd:scope>
      <gmd:DQ_Scope>
        <gmd:level>
          <gmd:MD_ScopeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset"/>
        </gmd:level>
      </gmd:DQ_Scope>
    </gmd:scope>
      <!-- TG Requirement C.20: metadata/2.0/req/common/conformity: The degree of conformity of the described resource with an INSPIRE Implementing Rule, specification document or Conformance Class, shall be given using one or several gmd:DQ_ConformanceResult elements under gmd:report/gmd:DQ_DomainConsistency/gmd:result. For each conformity statement (i.e. for each specification), a separate gmd:DQ_ConformanceResult element shall be used. The multiplicity of this element is 1..*. -->
      <!-- TG Requirement C.21: metadata/2.0/req/common/conformity-specification: Each gmd:report/gmd:DQ_DomainConsistency/gmd:result/gmd:DQ_ConformanceResult element shall include a citation of the INSPIRE Implementing Rule, specification document or Conformance Class, including its official title and the date of publication of the document, using gmd:specification/gmd:CI_Citation element.
      The title shall be given using the gmd:title child element of the citation element with a Non-empty Free Text Element content. For the INSPIRE Implementation Rule documents the value of the title element shall match exactly the official title of the cited document in the language of the metadata.
      The publication date of the cited document shall be given using gmd:date child element.
      The date value shall be expressed in accordance with ISO 8601 with only the date part included. The date type code element gmd:date/gmd:CI_Date/gmd:dateType/gmd:CI_DateTypeCode shall be given and it shall point to the value "publication" of the ISO 19139 code list CI_DateTypeCode. -->
      <!-- TG Requirement C.22: metadata/2.0/req/common/conformity-degree: Each gmd:report/gmd:DQ_DomainConsistency/gmd:result/gmd:DQ_ConformanceResult element containing a specification citation described in Requirement C.21 shall also include the degree of declared conformity against this specification using gmd:pass property with gco:Boolean value of "true" for a conformant resource and "false" for non-conformant resource. If the conformity has not yet been evaluated, the gmd:pass element shall be empty and contain a nil reason attribute with value "unknown". -->
      <!-- TG Requirement 1.10: metadata/2.0/req/datasets-and-series/conformity: Metadata for an INSPIRE data set or data set series shall declare conformity to the Implementing Rules for interoperability of spatial data sets and services, and it shall be encoded using gmd:report/gmd:DQ_DomainConsistency/gmd:result/gmd:DQ_ConformanceResult element as specified in TG Requirement C.20. This element shall contain citation of the [Regulation 1089/2010] encoded according to TG Requirement C.21. The degree of conformity shall be encoded as according to TG Requirement C.22. -->
      <gmd:report>
        <gmd:DQ_DomainConsistency>
          <gmd:result>
            <gmd:DQ_ConformanceResult>
              <gmd:specification>
                <gmd:CI_Citation>
                  <gmd:title>
                    <gmx:Anchor xlink:href="http://data.europa.eu/eli/reg/2010/1089">Commission Regulation (EU) No 1089/2010 of 23 November 2010 implementing Directive 2007/2/EC of the European Parliament and of the Council as regards interoperability of spatial data sets and services</gmx:Anchor>
                  </gmd:title>
                  <gmd:date>
                    <gmd:CI_Date>
                      <gmd:date>
                        <gco:Date>2010-12-08</gco:Date>
                      </gmd:date>
                      <gmd:dateType>
                        <gmd:CI_DateTypeCode codeList="http://standards.iso.org/iso/19139/resources/gmxCodelists.xml#CI_DateTypeCode" codeListValue="publication">Publication</gmd:CI_DateTypeCode>
                      </gmd:dateType>
                    </gmd:CI_Date>
                  </gmd:date>
                </gmd:CI_Citation>
              </gmd:specification>
              <gmd:explanation>
                <gco:CharacterString>This data set is conformant with the INSPIRE Implementing Rules for the interoperability of spatial data sets and services</gco:CharacterString>
              </gmd:explanation>
              <gmd:pass>
                <gco:Boolean>true</gco:Boolean>
              </gmd:pass>
            </gmd:DQ_ConformanceResult>
          </gmd:result>
        </gmd:DQ_DomainConsistency>
      </gmd:report>
      <!-- TG Requirement 1.11: metadata/2.0/req/datasets-and-series/lineage: The lineage statement for the described data set or data set series shall be given. It shall be included in the gmd:dataQualityInfo/gmd:DQ_DataQuality element scoped to the entire described data sets or data sets series as specified by TG Requirement 1.9.
      The lineage shall be encoded using the gmd:lineage/gmd:LI_Lineage/gmd:statement element with a Non-empty Free Text Element content, and it shall contain the description of the lineage of the described data set or series.
      The multiplicity of this element is 1. -->
      <gmd:lineage>
        <gmd:LI_Lineage>
          <gmd:statement>
            <gco:CharacterString>${
              factsheet.algemeneBeschrijvingVanHerkomst
            }</gco:CharacterString>
          </gmd:statement>
        </gmd:LI_Lineage>
      </gmd:lineage>
    </gmd:DQ_DataQuality>
  </gmd:dataQualityInfo>
</gmd:MD_Metadata> 
`
