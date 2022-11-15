export function formatKeywords(indexableWfsProperties) {
  return indexableWfsProperties
    .reduce((keywords, indexableWfsProperty) => {
      keywords.push(...indexableWfsProperty.keywords)
      return keywords
    }, [])
    .join(' - ')
}