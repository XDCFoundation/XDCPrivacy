const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  
  return data
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export const api = {
  // Auth
  async register(name: string, email: string, password: string) {
    return request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
  },

  async login(email: string, password: string) {
    return request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  async getMe(token: string) {
    return request('/api/v1/auth/me', {
      headers: authHeaders(token),
    })
  },

  async lookupParty(email: string) {
    return request(`/api/v1/auth/lookup?email=${encodeURIComponent(email)}`)
  },

  // Domains
  async getDomains(token: string) {
    return request('/api/v1/domains', {
      headers: authHeaders(token),
    })
  },

  async createDomain(token: string, name: string, description?: string) {
    return request('/api/v1/domains', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name, description }),
    })
  },

  async getDomain(token: string, id: string) {
    return request(`/api/v1/domains/${id}`, {
      headers: authHeaders(token),
    })
  },

  async inviteToDomain(token: string, domainId: string, partyId: string, role: string = 'MEMBER') {
    return request(`/api/v1/domains/${domainId}/invite`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ partyId, role }),
    })
  },

  // Transactions
  async getTransactions(token: string, params?: { domainId?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return request(`/api/v1/transactions${query ? `?${query}` : ''}`, {
      headers: authHeaders(token),
    })
  },

  async createTransaction(token: string, data: {
    domainId: string
    type: string
    payload: any
    parties: { partyId: string; role: string }[]
  }) {
    return request('/api/v1/transactions', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    })
  },

  async getTransaction(token: string, id: string) {
    return request(`/api/v1/transactions/${id}`, {
      headers: authHeaders(token),
    })
  },

  async decryptTransaction(token: string, id: string, privateKey: string) {
    return request(`/api/v1/transactions/${id}/decrypt`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ privateKey }),
    })
  },

  async signTransaction(token: string, id: string, privateKey: string) {
    return request(`/api/v1/transactions/${id}/sign`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ privateKey }),
    })
  },

  async commitTransaction(token: string, id: string) {
    return request(`/api/v1/transactions/${id}/commit`, {
      method: 'POST',
      headers: authHeaders(token),
    })
  },

  async verifyTransaction(token: string, id: string) {
    return request(`/api/v1/transactions/${id}/verify`, {
      headers: authHeaders(token),
    })
  },

  // Disclosures
  async getDisclosures(token: string, type?: 'all' | 'granted' | 'received') {
    return request(`/api/v1/disclosures${type ? `?type=${type}` : ''}`, {
      headers: authHeaders(token),
    })
  },

  async createDisclosure(token: string, data: {
    transactionId: string
    receiverId: string
    disclosedFields: string[]
    purpose?: string
    expiresInDays?: number
  }) {
    return request('/api/v1/disclosures', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    })
  },

  async decryptDisclosure(token: string, id: string, privateKey: string) {
    return request(`/api/v1/disclosures/${id}/decrypt`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ privateKey }),
    })
  },

  // Commitments/Blockchain
  async getBlockchainStatus() {
    return request('/api/v1/commitments/status')
  },

  async getCommitment(hash: string, verify: boolean = false) {
    return request(`/api/v1/commitments/${hash}${verify ? '?verify=true' : ''}`)
  },

  async verifyCommitment(data: any, nonce: string, expectedCommitment: string) {
    return request('/api/v1/commitments/verify', {
      method: 'POST',
      body: JSON.stringify({ data, nonce, expectedCommitment }),
    })
  },

  async getStats() {
    return request('/api/v1/commitments/stats/overview')
  },
}
