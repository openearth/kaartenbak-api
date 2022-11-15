export function withServerDefaults(fn) {
  return async (...args) => {
    try {
      const response = await fn(...args)
      
      return {
        statusCode: 200,
        ...response,
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...response?.headers,
        },
      }
    } catch (e) {
      console.log(error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed fetching data' }),
      }
    }
  }
}
