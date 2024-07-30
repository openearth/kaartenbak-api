import { withServerDefaults } from '../lib/with-server-defaults'

export const handler = withServerDefaults(async (event, _) => {
  /* Protect this endpoint by using a token */
  if (process.env.SYNC_LAYER_API_TOKEN !== event.headers['x-api-key']) {
    return {
      statusCode: 401,
    }
  }

  console.log('Syncing layer', JSON.parse(event.body, null, 2))
})
