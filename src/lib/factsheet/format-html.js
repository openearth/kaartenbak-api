export const format = (item) => /* html */ `
<!DOCTYPE html>
<html>
<head>
  <title>${item.title}</title>
</head>
<body>
  <h1>${item.title}</h1>

  <h2>Titel/naam meet/monitorprogramma</h2>
  <p>${item.metadata.citationTitle}</p>

  <h2>Samenvatting (korte beschrijving van de inhoud van de dataset)</h2>
  <p>${item.metadata.abstract}</p>

  <h2>Thema's (b.v. diversiteit, verspreiding, trends, reproductiesucces) </h2>
  <p>${item.metadata.descriptivekeywordsKeywords.map(keyword => keyword.title).join(', ')}</p>
</body>

</html>
`
