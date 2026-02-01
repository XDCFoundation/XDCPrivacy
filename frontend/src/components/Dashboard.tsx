'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { 
  PlusIcon, 
  DocumentTextIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

interface DashboardProps {
  token: string
  party: any
  keys: { identity: string; encryption: string } | null
}

export function Dashboard({ token, party, keys }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'domains' | 'disclosures'>('transactions')
  const [transactions, setTransactions] = useState<any[]>([])
  const [domains, setDomains] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateTx, setShowCreateTx] = useState(false)
  const [showCreateDomain, setShowCreateDomain] = useState(false)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [token])

  const loadData = async () => {
    setLoading(true)
    try {
      const [txs, doms, st] = await Promise.all([
        api.getTransactions(token),
        api.getDomains(token),
        api.getStats()
      ])
      setTransactions(txs.transactions || [])
      setDomains(doms.domains || [])
      setStats(st)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PARTIALLY_SIGNED: 'bg-orange-100 text-orange-800',
      FULLY_SIGNED: 'bg-blue-100 text-blue-800',
      COMMITTED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<DocumentTextIcon className="w-6 h-6" />}
          label="Transactions"
          value={stats?.transactions?.total || 0}
          color="blue"
        />
        <StatCard
          icon={<CheckCircleIcon className="w-6 h-6" />}
          label="Committed"
          value={stats?.transactions?.committed || 0}
          color="green"
        />
        <StatCard
          icon={<BuildingOffice2Icon className="w-6 h-6" />}
          label="Domains"
          value={stats?.domains || 0}
          color="purple"
        />
        <StatCard
          icon={<LockClosedIcon className="w-6 h-6" />}
          label="Private"
          value="100%"
          color="cyan"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <TabButton
              active={activeTab === 'transactions'}
              onClick={() => setActiveTab('transactions')}
              icon={<DocumentTextIcon className="w-4 h-4" />}
              label="Transactions"
            />
            <TabButton
              active={activeTab === 'domains'}
              onClick={() => setActiveTab('domains')}
              icon={<BuildingOffice2Icon className="w-4 h-4" />}
              label="Privacy Domains"
            />
            <TabButton
              active={activeTab === 'disclosures'}
              onClick={() => setActiveTab('disclosures')}
              icon={<EyeIcon className="w-4 h-4" />}
              label="Disclosures"
            />
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === 'transactions' && (
                <TransactionsTab
                  transactions={transactions}
                  token={token}
                  keys={keys}
                  onRefresh={loadData}
                  onCreateNew={() => setShowCreateTx(true)}
                />
              )}
              {activeTab === 'domains' && (
                <DomainsTab
                  domains={domains}
                  token={token}
                  onRefresh={loadData}
                  onCreateNew={() => setShowCreateDomain(true)}
                />
              )}
              {activeTab === 'disclosures' && (
                <DisclosuresTab token={token} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Transaction Modal */}
      {showCreateTx && (
        <CreateTransactionModal
          token={token}
          domains={domains}
          onClose={() => setShowCreateTx(false)}
          onCreated={() => {
            setShowCreateTx(false)
            loadData()
          }}
        />
      )}

      {/* Create Domain Modal */}
      {showCreateDomain && (
        <CreateDomainModal
          token={token}
          onClose={() => setShowCreateDomain(false)}
          onCreated={() => {
            setShowCreateDomain(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600'
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${colors[color]}`}>
        {icon}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'text-blue-600 border-blue-600'
          : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function TransactionsTab({ transactions, token, keys, onRefresh, onCreateNew }: any) {
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [decrypting, setDecrypting] = useState(false)
  const [decryptedData, setDecryptedData] = useState<any>(null)

  const handleDecrypt = async (tx: any) => {
    if (!keys?.encryption) {
      alert('No encryption key found. Please re-login.')
      return
    }
    setDecrypting(true)
    try {
      const result = await api.decryptTransaction(token, tx.id, keys.encryption)
      setDecryptedData(result.payload)
    } catch (err: any) {
      alert('Decryption failed: ' + err.message)
    } finally {
      setDecrypting(false)
    }
  }

  const handleSign = async (tx: any) => {
    if (!keys?.identity) {
      alert('No identity key found. Please re-login.')
      return
    }
    try {
      await api.signTransaction(token, tx.id, keys.identity)
      alert('Transaction signed successfully!')
      onRefresh()
    } catch (err: any) {
      alert('Signing failed: ' + err.message)
    }
  }

  const handleCommit = async (tx: any) => {
    try {
      const result = await api.commitTransaction(token, tx.id)
      alert(`Committed! TX Hash: ${result.txHash}`)
      onRefresh()
    } catch (err: any) {
      alert('Commit failed: ' + err.message)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Private Transactions</h3>
        <button
          onClick={onCreateNew}
          className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Transaction</span>
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-400" />
          <p className="mt-2">No transactions yet</p>
          <p className="text-sm">Create your first private transaction</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx: any) => (
            <div key={tx.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-medium">{tx.transactionId}</span>
                    {tx.committed && <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {tx.type} • {tx.parties?.length || 0} parties • {tx.domain?.name}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(tx.status)}
                </div>
              </div>
              
              <div className="mt-3 flex items-center space-x-2">
                <button
                  onClick={() => handleDecrypt(tx)}
                  disabled={decrypting}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  🔓 Decrypt
                </button>
                {tx.status === 'PENDING' && (
                  <button
                    onClick={() => handleSign(tx)}
                    className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    ✍️ Sign
                  </button>
                )}
                {tx.status === 'FULLY_SIGNED' && !tx.committed && (
                  <button
                    onClick={() => handleCommit(tx)}
                    className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    ⛓️ Commit to XDC
                  </button>
                )}
              </div>

              {decryptedData && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Decrypted Payload:</div>
                  <pre className="text-xs overflow-x-auto">{JSON.stringify(decryptedData, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PARTIALLY_SIGNED: 'bg-orange-100 text-orange-800',
    FULLY_SIGNED: 'bg-blue-100 text-blue-800',
    COMMITTED: 'bg-green-100 text-green-800'
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function DomainsTab({ domains, token, onRefresh, onCreateNew }: any) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Privacy Domains</h3>
        <button
          onClick={onCreateNew}
          className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Domain</span>
        </button>
      </div>

      {domains.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BuildingOffice2Icon className="w-12 h-12 mx-auto text-gray-400" />
          <p className="mt-2">No domains yet</p>
          <p className="text-sm">Create a privacy domain for your consortium</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {domains.map((domain: any) => (
            <div key={domain.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{domain.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{domain.description || 'No description'}</p>
                </div>
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                  {domain.myRole}
                </span>
              </div>
              <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                <span>{domain.memberCount} members</span>
                <span>{domain.transactionCount} transactions</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DisclosuresTab({ token }: any) {
  const [disclosures, setDisclosures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDisclosures()
  }, [token])

  const loadDisclosures = async () => {
    try {
      const result = await api.getDisclosures(token)
      setDisclosures(result.disclosures || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Selective Disclosures</h3>
      
      {disclosures.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <EyeIcon className="w-12 h-12 mx-auto text-gray-400" />
          <p className="mt-2">No disclosures yet</p>
          <p className="text-sm">Create disclosures to share specific fields with auditors</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disclosures.map((d: any) => (
            <div key={d.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between">
                <div>
                  <span className="font-mono text-sm">{d.transactionId}</span>
                  <div className="text-sm text-gray-500 mt-1">
                    To: {d.receiver?.name} • Fields: {d.disclosedFields?.join(', ')}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${d.isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {d.isExpired ? 'Expired' : 'Active'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateTransactionModal({ token, domains, onClose, onCreated }: any) {
  const [domainId, setDomainId] = useState('')
  const [txType, setTxType] = useState('TRADE_FINANCE')
  const [payload, setPayload] = useState('{\n  "buyer": "Acme Corp",\n  "seller": "Steel Inc",\n  "amount": 100000,\n  "commodity": "Hot-rolled Steel"\n}')
  const [partyEmail, setPartyEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let parsedPayload
      try {
        parsedPayload = JSON.parse(payload)
      } catch {
        alert('Invalid JSON payload')
        setLoading(false)
        return
      }

      // Lookup party by email if provided
      let parties: any[] = []
      if (partyEmail) {
        const partyLookup = await api.lookupParty(partyEmail)
        if (partyLookup.partyId) {
          parties.push({ partyId: partyLookup.partyId, role: 'SIGNATORY' })
        }
      }

      await api.createTransaction(token, {
        domainId,
        type: txType,
        payload: parsedPayload,
        parties
      })
      onCreated()
    } catch (err: any) {
      alert('Failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Create Private Transaction</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Privacy Domain</label>
            <select
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Select domain...</option>
              {domains.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="TRADE_FINANCE">Trade Finance</option>
              <option value="RWA_TRANSFER">RWA Transfer</option>
              <option value="DVP_SETTLEMENT">DvP Settlement</option>
              <option value="PAYMENT">Payment</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Counterparty Email (optional)</label>
            <input
              type="email"
              value={partyEmail}
              onChange={(e) => setPartyEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="counterparty@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payload (JSON)</label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-40"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateDomainModal({ token, onClose, onCreated }: any) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.createDomain(token, name, description)
      onCreated()
    } catch (err: any) {
      alert('Failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Create Privacy Domain</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., TradeFinance Consortium"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Domain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
