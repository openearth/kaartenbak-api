export function formatFactsheetOverviewHTML(factsheets) {
  return (html = /* html */ `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Kaartenbak API</title>
  </head>
  <body>
    <h1>Kaartenbak API</h1>
    <h2>Factsheets</h2>
    <ul>
      ${factsheets.map(
        (factsheet) => /* html */ `
        <li>
          <h3>${factsheet.title}</h3>
          <a href="/api/factsheet?id=${factsheet.id}&format=html">HTML</a>
          <a href="/api/factsheet?id=${factsheet.id}&format=json">JSON</a>
        </li>`
      )}
    </ul>
  </body>
  </html>
  `)
}
