/**
 * GeoNetwork XML Format Detection Utilities
 * 
 * This file contains detection methods for various XML formats that 
 * GeoNetwork transforms to ISO19139.
 */

import { JSDOM } from 'jsdom';

/**
 * Main function to detect the format of an XML string from GeoNetwork
 * @param {string} xmlString - The XML response from GeoNetwork
 * @returns {string} The detected format transformation type
 */
export function detectFormatWith(xmlString) {
    const { window } = new JSDOM();
    const parser = new window.DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Check for parsing errors
    if (xmlDoc.documentElement.nodeName === "parsererror") {
        console.error("Error parsing XML:", xmlDoc.documentElement.textContent);
        return "Invalid XML";
    }

    const rootElement = xmlDoc.documentElement;
    const namespaces = getNamespaces(rootElement);

    // Run through various detection methods in order
    if (isDIF(rootElement, namespaces))
        return "DIF-to-ISO19139";

    if (isEsriGeosticker(rootElement, namespaces))
        return "EsriGeosticker-to-ISO19139";

    if (isISO19115(rootElement, namespaces))
        return "ISO19115-to-ISO19139";

    if (isCSWGetCapabilities(rootElement, namespaces))
        return "OGCCSWGetCapabilities-to-ISO19119_ISO19139";

    if (isOGCSLD(rootElement, namespaces))
        return "OGCSLD-to-ISO19139";

    if (isSOSGetCapabilities(rootElement, namespaces))
        return "OGCSOSGetCapabilities-to-ISO19119_ISO19139";

    if (isWCSGetCapabilities(rootElement, namespaces))
        return "OGCWCSGetCapabilities-to-ISO19119_ISO19139";

    if (isWFSDescribeFeatureType(rootElement, namespaces))
        return "OGCWFSDescribeFeatureType-to-ISO19110";

    if (isWFSGetCapabilities(rootElement, namespaces))
        return "OGCWFSGetCapabilities-to-ISO19119_ISO19139";

    if (isWMCorOWSC(rootElement, namespaces))
        return "OGCWMC-OR-OWSC-to-ISO19139";

    if (isWMSGetCapabilities(rootElement, namespaces))
        return "OGCWMSGetCapabilities-to-ISO19119_ISO19139";

    if (isWPSGetCapabilities(rootElement, namespaces))
        return "OGCWPSGetCapabilities-to-ISO19119_ISO19139";

    if (isGenericWxSGetCapabilities(rootElement, namespaces))
        return "OGCWxSGetCapabilities-to-ISO19119_ISO19139";

    if (isThreddsCatalog(rootElement, namespaces))
        return "ThreddsCatalog-to-ISO19119_ISO19139";

    // If already ISO19139, report it as such
    if (isISO19139(rootElement, namespaces))
        return null;

    return "Unknown XML Format";
}

/**
 * Helper function to extract all namespaces from an XML element
 * @param {Element} element - The XML element to extract namespaces from
 * @returns {Object} Object with namespace prefixes as keys and URIs as values
 */
function getNamespaces(element) {
    const namespaces = {};

    // Get all attributes that define namespaces
    for (const attr of element.attributes) {
        if (attr.name.startsWith('xmlns:')) {
            const prefix = attr.name.split(':')[1];
            namespaces[prefix] = attr.value;
        } else if (attr.name === 'xmlns') {
            namespaces['default'] = attr.value;
        }
    }

    return namespaces;
}

/**
 * Detects if the XML is in DIF (Directory Interchange Format) format
 */
function isDIF(rootElement, namespaces) {
    return rootElement.nodeName === 'DIF' ||
        (namespaces.dif && rootElement.getElementsByTagNameNS(namespaces.dif, 'DIF').length > 0);
}

/**
 * Detects if the XML is in ESRI Geosticker format
 */
function isEsriGeosticker(rootElement, namespaces) {
    return rootElement.nodeName === 'metadata' &&
        (rootElement.getAttribute('esri_format') === 'geosticker' ||
            rootElement.getElementsByTagName('esri').length > 0);
}

/**
 * Detects if the XML is in ISO 19115 format
 */
function isISO19115(rootElement, namespaces) {
    return rootElement.nodeName === 'MD_Metadata' &&
        !namespaces.gmd && !namespaces.gco;
}

/**
 * Detects if the XML is already in ISO 19139 format
 */
function isISO19139(rootElement, namespaces) {
    return (rootElement.nodeName === 'MD_Metadata' || rootElement.nodeName.endsWith(':MD_Metadata')) &&
        (namespaces.gmd || namespaces.gco);
}

/**
 * Detects if the XML is a CSW GetCapabilities document
 */
function isCSWGetCapabilities(rootElement, namespaces) {
    return (rootElement.nodeName === 'Capabilities' || rootElement.nodeName.endsWith(':Capabilities')) &&
        (namespaces.csw ||
            (rootElement.getAttribute('service') === 'CSW' &&
                rootElement.getElementsByTagName('OperationsMetadata').length > 0));
}

/**
 * Detects if the XML is an OGC SLD (Styled Layer Descriptor) document
 */
function isOGCSLD(rootElement, namespaces) {
    return rootElement.nodeName === 'StyledLayerDescriptor' ||
        rootElement.nodeName.endsWith(':StyledLayerDescriptor') ||
        namespaces.sld;
}

/**
 * Detects if the XML is a SOS GetCapabilities document
 */
function isSOSGetCapabilities(rootElement, namespaces) {
    return (rootElement.nodeName === 'Capabilities' || rootElement.nodeName.endsWith(':Capabilities')) &&
        (namespaces.sos ||
            (rootElement.getAttribute('service') === 'SOS' &&
                rootElement.getElementsByTagName('OperationsMetadata').length > 0));
}

/**
 * Detects if the XML is a WCS GetCapabilities document
 */
function isWCSGetCapabilities(rootElement, namespaces) {
    return (rootElement.nodeName === 'Capabilities' || rootElement.nodeName.endsWith(':Capabilities')) &&
        (namespaces.wcs ||
            (rootElement.getAttribute('service') === 'WCS' &&
                (rootElement.getElementsByTagName('ContentMetadata').length > 0 ||
                    rootElement.getElementsByTagName('CoverageOfferingBrief').length > 0 ||
                    rootElement.getElementsByTagName('Contents').length > 0)));
}

/**
 * Detects if the XML is a WFS DescribeFeatureType document
 */
function isWFSDescribeFeatureType(rootElement, namespaces) {
    return (rootElement.nodeName === 'schema' || rootElement.nodeName.endsWith(':schema')) &&
        (namespaces.xsd || namespaces.xs) &&
        (rootElement.getAttribute('targetNamespace') &&
            rootElement.getAttribute('targetNamespace').includes('wfs'));
}

/**
 * Detects if the XML is a WFS GetCapabilities document
 */
function isWFSGetCapabilities(rootElement, namespaces) {
    return (rootElement.nodeName === 'Capabilities' || rootElement.nodeName.endsWith(':Capabilities')) &&
        (namespaces.wfs ||
            (rootElement.getAttribute('service') === 'WFS' &&
                (rootElement.getElementsByTagName('FeatureTypeList').length > 0 ||
                    rootElement.getElementsByTagName('FeatureType').length > 0)));
}

/**
 * Detects if the XML is a Web Map Context (WMC) or OWS Context (OWSC) document
 */
function isWMCorOWSC(rootElement, namespaces) {
    return (rootElement.nodeName === 'ViewContext' || rootElement.nodeName.endsWith(':ViewContext') ||
        rootElement.nodeName === 'OWSContext' || rootElement.nodeName.endsWith(':OWSContext')) &&
        (namespaces.wmc || namespaces.owc || namespaces.owsc);
}

/**
 * Detects if the XML is a WMS GetCapabilities document
 */
function isWMSGetCapabilities(rootElement, namespaces) {
    return (rootElement.nodeName === 'Capabilities' || rootElement.nodeName.endsWith(':Capabilities') ||
        rootElement.nodeName === 'WMS_Capabilities' || rootElement.nodeName.endsWith(':WMS_Capabilities')) &&
        (namespaces.wms ||
            (rootElement.getAttribute('service') === 'WMS' &&
                (rootElement.getElementsByTagName('Layer').length > 0 ||
                    rootElement.getElementsByTagName('Capability').length > 0)));
}

/**
 * Detects if the XML is a WPS GetCapabilities document
 */
function isWPSGetCapabilities(rootElement, namespaces) {
    return (rootElement.nodeName === 'Capabilities' || rootElement.nodeName.endsWith(':Capabilities')) &&
        (namespaces.wps ||
            (rootElement.getAttribute('service') === 'WPS' &&
                rootElement.getElementsByTagName('ProcessOfferings').length > 0));
}

/**
 * Detects if the XML is a generic WxS GetCapabilities document
 * This is a fallback for other OGC web services not specifically handled
 */
function isGenericWxSGetCapabilities(rootElement, namespaces) {
    return (rootElement.nodeName === 'Capabilities' || rootElement.nodeName.endsWith(':Capabilities')) &&
        (rootElement.getAttribute('service') &&
            rootElement.getAttribute('service').match(/^W[A-Z]S$/) &&
            rootElement.getElementsByTagName('OperationsMetadata').length > 0);
}

/**
 * Detects if the XML is a THREDDS catalog
 */
function isThreddsCatalog(rootElement, namespaces) {
    return (rootElement.nodeName === 'catalog' || rootElement.nodeName.endsWith(':catalog')) &&
        (namespaces.thredds ||
            rootElement.getAttribute('xmlns') === 'http://www.unidata.ucar.edu/namespaces/thredds/InvCatalog/v1.0' ||
            rootElement.getElementsByTagName('dataset').length > 0);
}
