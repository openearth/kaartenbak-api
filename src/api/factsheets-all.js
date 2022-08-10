const { datocmsRequest } = require("../lib/datocms");

const query = /* graphql */ `
query Factsheets {
  allFactsheets {
    id
    title
  }
}
`;

exports.handler = async (event, context) => {
  try {
    const data = await datocmsRequest({ query });
    return { statusCode: 200, body: JSON.stringify({ data }) };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed fetching data" }),
    };
  }
};
