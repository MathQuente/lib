import 'dotenv/config'

const clientId = process.env.IGDB_CLIENT_ID
const clientSecret = process.env.IGDB_CLIENT_SECRET

console.log('Client ID:', clientId ? clientId.slice(0, 6) + '...' : 'MISSING')
console.log('Client Secret:', clientSecret ? '***' : 'MISSING')

const tokenRes = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  { method: 'POST' }
)
const tokenData = await tokenRes.json()
console.log('Token response:', JSON.stringify(tokenData).slice(0, 100))

const token = tokenData.access_token
if (!token) {
  console.error('Failed to get token')
  process.exit(1)
}

const now = Math.floor(Date.now() / 1000)
const queries = [
  `fields id,name,cover.url,rating; where first_release_date < ${now} & first_release_date != null & cover != null; sort first_release_date desc; limit 5;`,
]

for (const q of queries) {
  console.log('\n--- Query:', q.slice(0, 60))
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: q,
  })
  const data = await res.json()
  console.log('Status:', res.status)
  console.log('Result:', JSON.stringify(data).slice(0, 300))
}
