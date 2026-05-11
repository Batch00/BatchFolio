const BASE_URL = 'https://finnhub.io/api/v1'

export async function finnhubFetch(endpoint, params = {}) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new Error('FINNHUB_API_KEY is not set')

  // Allow callers to pass either '/path' or '/path?foo=bar'
  const [path, existingQuery] = endpoint.split('?')
  const url = new URL(`${BASE_URL}${path}`)
  if (existingQuery) {
    for (const [k, v] of new URLSearchParams(existingQuery).entries()) {
      url.searchParams.set(k, v)
    }
  }
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  url.searchParams.set('token', apiKey)

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  if (!res.ok) {
    throw new Error(`Finnhub error ${res.status}: ${res.statusText}`)
  }
  return res.json()
}
