export function withServerError(fn) {
  return (...args) => {
    try {
      return fn(...args)
    } catch (e) {
      console.log(error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed fetching data' }),
      }
    }
  }
}
