'use client';

import { useState, useEffect } from 'react';

const NETWORKS = {
  mainnet: {
    name: 'XDC Mainnet',
    chainId: 50,
    rpcUrl: 'https://rpc.xdc.org',
    explorerUrl: 'https://explorer.xdc.org',
    symbol: 'XDC',
  },
  apothem: {
    name: 'XDC Apothem (Testnet)',
    chainId: 51,
    rpcUrl: 'https://rpc.apothem.network',
    explorerUrl: 'https://explorer.apothem.network',
    symbol: 'TXDC',
  },
};

type NetworkType = 'mainnet' | 'apothem';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.privacy.xdc.network';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showNewTx, setShowNewTx] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) fetchUser(token);
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setIsLoggedIn(true);
        fetchTransactions(token);
      }
    } catch (e) {
      console.error('Failed to fetch user');
    }
  };

  const fetchTransactions = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.error('Failed to fetch transactions');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      setUser(data.party);
      setIsLoggedIn(true);
      fetchTransactions(data.token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      alert(`⚠️ SAVE YOUR PRIVATE KEYS!\n\nIdentity Key: ${data.keys.identityPrivateKey.slice(0,20)}...\nEncryption Key: ${data.keys.encryptionPrivateKey.slice(0,20)}...\n\nThese cannot be recovered!`);
      localStorage.setItem('token', data.token);
      setUser(data.party);
      setIsLoggedIn(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUser(null);
    setTransactions([]);
  };

  // Dashboard view
  if (isLoggedIn && user) {
    return (
      <main className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center space-x-3">
                <img src="/xdc-logo.png" alt="XDC" className="h-10 w-10 rounded-full" />
                <span className="text-xl font-semibold text-gray-900">XDC Privacy</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">{user.name}</span>
                <button onClick={logout} className="text-sm text-red-500 hover:text-red-600 font-medium">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-2">🔐</div>
              <div className="text-2xl font-bold text-gray-900">{transactions.length}</div>
              <div className="text-gray-500 text-sm">Private Transactions</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-2">⛓️</div>
              <div className="text-2xl font-bold text-gray-900">{transactions.filter(t => t.status === 'COMMITTED').length}</div>
              <div className="text-gray-500 text-sm">On-Chain Commitments</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-2">👁️</div>
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-gray-500 text-sm">Selective Disclosures</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-2">🏢</div>
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-gray-500 text-sm">Privacy Domains</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Private Transactions</h2>
            <button
              onClick={() => setShowNewTx(true)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              + New Transaction
            </button>
          </div>

          {/* Transactions */}
          {transactions.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
              <div className="text-5xl mb-4">🔒</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Private Transactions Yet</h3>
              <p className="text-gray-500 mb-6">Create your first confidential transaction</p>
              <button
                onClick={() => setShowNewTx(true)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Create Transaction
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-gray-200 transition">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-900 font-medium">{tx.transactionId}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          tx.status === 'COMMITTED' ? 'bg-green-100 text-green-700' :
                          tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">{tx.txType?.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-400 text-xs">Commitment</div>
                      <div className="text-gray-600 font-mono text-sm">{tx.commitmentHash?.slice(0,12)}...</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showNewTx && (
          <NewTransactionModal
            onClose={() => setShowNewTx(false)}
            onSuccess={() => {
              setShowNewTx(false);
              fetchTransactions(localStorage.getItem('token') || '');
            }}
          />
        )}
      </main>
    );
  }

  // Login/Register view - Clean and minimal
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <img src="/xdc-logo.png" alt="XDC" className="h-10 w-10 rounded-full" />
            <span className="text-xl font-semibold text-gray-900">XDC Privacy</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left - Hero */}
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-6">
              🔐 Confidentiality Layer for XDC
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Enterprise-Grade<br />
              <span className="text-blue-600">Confidential Transactions</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Privacy-preserving transactions on XDC Network. Only parties involved can see transaction details.
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-1">🔒</div>
                <div className="text-gray-900 font-medium text-sm">End-to-End Encrypted</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-1">⛓️</div>
                <div className="text-gray-900 font-medium text-sm">On-Chain Commits</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-1">👁️</div>
                <div className="text-gray-900 font-medium text-sm">Selective Disclosure</div>
              </div>
            </div>
          </div>

          {/* Right - Auth Card */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="flex mb-6 border-b border-gray-100">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 pb-3 text-sm font-medium ${
                  activeTab === 'login' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 pb-3 text-sm font-medium ${
                  activeTab === 'register' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={activeTab === 'login' ? handleLogin : handleRegister} className="space-y-4">
              {activeTab === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Acme Corporation"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 disabled:opacity-50 transition"
              >
                {loading ? 'Please wait...' : activeTab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Built for Enterprise Privacy</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-xl">📄</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Trade Finance</h3>
              <p className="text-gray-600 text-sm">Letters of credit and trade documents with full confidentiality.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-xl">🏠</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">RWA Tokenization</h3>
              <p className="text-gray-600 text-sm">Private transfers with selective disclosure to regulators.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-xl">💱</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confidential DvP</h3>
              <p className="text-gray-600 text-sm">Delivery vs Payment with terms hidden from non-participants.</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-white border-t border-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">© 2026 XDC Privacy</span>
            <div className="flex space-x-6 text-gray-400 text-sm">
              <a href="#" className="hover:text-gray-600">Docs</a>
              <a href="https://xdc.org" className="hover:text-gray-600">XDC.org</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

// Transaction Modal - with wallet connect & network selection
function NewTransactionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) {
  const [step, setStep] = useState(1);
  const [network, setNetwork] = useState<NetworkType>('apothem');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [txType, setTxType] = useState('TRADE_FINANCE');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or XDCPay wallet');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const targetNetwork = NETWORKS[network];
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetNetwork.chainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetNetwork.chainId.toString(16)}`,
              chainName: targetNetwork.name,
              nativeCurrency: { name: 'XDC', symbol: targetNetwork.symbol, decimals: 18 },
              rpcUrls: [targetNetwork.rpcUrl],
              blockExplorerUrls: [targetNetwork.explorerUrl],
            }],
          });
        }
      }
      setWalletAddress(accounts[0]);
      setWalletConnected(true);
    } catch (e: any) {
      alert(e.message || 'Failed to connect wallet');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: txType,
          counterpartyEmail: counterparty || undefined,
          payload: { amount: parseFloat(amount), counterparty, description, network },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error: ${data.error || 'Failed'}`);
        return;
      }
      
      if (walletConnected && window.ethereum) {
        try {
          const commitHash = data.transaction?.commitmentHash || data.commitmentHash;
          const hash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: walletAddress,
              to: '0x0000000000000000000000000000000000000000',
              value: '0x0',
              data: commitHash,
            }],
          });
          setTxHash(hash);
        } catch (e) {
          console.error('On-chain failed:', e);
        }
      }
      setStep(3);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-gray-900">New Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={txType} onChange={(e) => setTxType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500">
                <option value="TRADE_FINANCE">Trade Finance</option>
                <option value="RWA_TRANSFER">RWA Transfer</option>
                <option value="DVP_SETTLEMENT">DvP Settlement</option>
                <option value="PAYMENT">Payment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                placeholder="100000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Counterparty Email</label>
              <input type="email" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                placeholder="partner@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                placeholder="Transaction details..." rows={2} />
            </div>
            <button onClick={() => setStep(2)}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Type:</span><span className="text-gray-900">{txType.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount:</span><span className="text-gray-900">${parseInt(amount || '0').toLocaleString()}</span></div>
                {counterparty && <div className="flex justify-between"><span className="text-gray-500">To:</span><span className="text-gray-900">{counterparty}</span></div>}
              </div>
            </div>

            {/* Network & Wallet - only shown here */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
              <select value={network} onChange={(e) => setNetwork(e.target.value as NetworkType)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500">
                <option value="apothem">Apothem Testnet</option>
                <option value="mainnet">XDC Mainnet</option>
              </select>
            </div>

            {!walletConnected ? (
              <button onClick={connectWallet}
                className="w-full py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 flex items-center justify-center space-x-2">
                <span>🔗</span><span>Connect Wallet for On-Chain Commit</span>
              </button>
            ) : (
              <div className="text-sm text-green-600 text-center py-2">
                ✓ Wallet connected: {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}
              </div>
            )}

            <div className="flex space-x-3">
              <button onClick={() => setStep(1)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200">
                Back
              </button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Transaction Created!</h3>
            <p className="text-gray-500 text-sm mb-4">Your confidential transaction is ready.</p>
            {txHash && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-gray-400 text-xs mb-1">On-Chain TX</div>
                <a href={`${NETWORKS[network].explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 text-sm font-mono break-all">{txHash.slice(0,20)}...</a>
              </div>
            )}
            <button onClick={onSuccess}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window { ethereum?: any; }
}
