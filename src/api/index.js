const { datocmsRequest } = require('../lib/datocms')

const query = /* graphql */ `
query Factsheets {
  allFactsheets {
    id
    title
  }
}
`

exports.handler = async (event, context) => {
  try {
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
            <a href="/api/factsheet?id=${factsheet.id}&format=xml">INSPIRE XML</a>
            <a href="/api/factsheet?id=${factsheet.id}&format=json">INSPIRE JSON</a>
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
  } catch (error) {
    console.log(error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed fetching data' }),
    }
  }
}
