const FINNHUB_BASE = 'https://finnhub.io/api/v1'

export async function finnhubFetch(endpoint) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new Error('FINNHUB_API_KEY is not set')

  const url = `${FINNHUB_BASE}${endpoint}&token=${apiKey}`
  const res = await fetch(url, { next: { revalidate: 60 } })

  if (!res.ok) {
    throw new Error(`Finnhub error ${res.status}: ${res.statusText}`)
  }

  return res.json()
}
