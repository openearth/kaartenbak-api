const { datocmsRequest } = require("../lib/datocms");

const query = /* graphql */ `
query FactsheetById($id: ItemId) {
  factsheet(filter: {id: {eq: $id}}) {
    id
    title
    urlOriginalFile
  }
}
`;

exports.handler = async (event, context) => {
  const { id } = event.queryStringParameters;

  if (!id) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "id query parameter is required" }),
    };
  }

  try {
    const data = await datocmsRequest({ query, variables: { id } });
    return { statusCode: 200, body: JSON.stringify({ data }) };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed fetching data" }),
    };
  }
};
