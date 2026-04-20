const output = document.getElementById('output')

async function makeRequest(url, options = {}) {
  output.textContent = `Requesting ${options.method || 'GET'} ${url}...`
  try {
    const res = await fetch(url, options)
    const text = await res.text()
    output.textContent = `Status: ${res.status}\n\n${text}`
    output.dataset.status = res.status
    output.dataset.body = text
  } catch (err) {
    output.textContent = `Error: ${err.message}`
  }
}

// ─── Basic requests ───────────────────────────────────────────────────────────

document.getElementById('btn-get-users').addEventListener('click', () =>
  makeRequest('http://localhost:3333/api/users'),
)

document.getElementById('btn-post-login').addEventListener('click', () =>
  makeRequest('http://localhost:3333/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test', password: 'test' }),
  }),
)

document.getElementById('btn-get-profile').addEventListener('click', () =>
  makeRequest('http://localhost:3333/api/profile'),
)

// ─── Query params ─────────────────────────────────────────────────────────────

document.getElementById('btn-get-feed').addEventListener('click', () =>
  makeRequest('http://localhost:3333/api/feed?limit=5&offset=0'),
)

// ─── POST with JSON body ──────────────────────────────────────────────────────

document.getElementById('btn-post-data').addEventListener('click', () =>
  makeRequest('http://localhost:3333/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value', timestamp: Date.now() }),
  }),
)

// ─── GraphQL ──────────────────────────────────────────────────────────────────

document.getElementById('btn-graphql').addEventListener('click', () =>
  makeRequest('http://localhost:3333/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operationName: 'GetUser',
      query: 'query GetUser($id: ID!) { user(id: $id) { id name email } }',
      variables: { id: '1' },
    }),
  }),
)

// ─── Custom header request ────────────────────────────────────────────────────

document.getElementById('btn-custom-header').addEventListener('click', () =>
  makeRequest('http://localhost:3333/api/secure', {
    headers: { 'x-client': 'mockmate-test' },
  }),
)
