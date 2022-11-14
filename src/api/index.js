const { datocmsRequest } = require('../lib/datocms')
const { withServerError } = require('../lib/with-server-error')

const query = /* graphql */ `
query Factsheets {
  allFactsheets {
    id
    title
  }
}
`

exports.handler = withServerError(async (event, context) => {
  const data = await datocmsRequest({ query })

  const html = /* html */ `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Kaartenbak API</title>
    </head>
    <body>
      <h1>Kaartenbak API</h1>
      <h2>Factsheets</h2>
      <ul>
        ${data.allFactsheets.map(
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
    `

  return {
    statusCode: 200,
    body: html,
    headers: {
      'content-type': 'text/html',
      'Access-Control-Allow-Origin': '*',
    },
  }
})
