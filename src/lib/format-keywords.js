export function formatKeywords(indexableWfsProperties) {
  if (indexableWfsProperties) {
    return indexableWfsProperties
      .reduce((keywords, indexableWfsProperty) => {
        keywords.push(...indexableWfsProperty.keywords)
        return keywords
      }, [])
      .join(' - ')
  }

  return ''
}