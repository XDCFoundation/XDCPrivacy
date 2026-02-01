'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { ShieldCheckIcon, KeyIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface AuthPanelProps {
  onLogin: (token: string, party: any, keys?: any) => void
}

export function AuthPanel({ onLogin }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationKeys, setRegistrationKeys] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'register') {
        const result = await api.register(name, email, password)
        setRegistrationKeys(result.keys)
        onLogin(result.token, result.party, {
          identity: result.keys.identityPrivateKey,
          encryption: result.keys.encryptionPrivateKey
        })
      } else {
        const result = await api.login(email, password)
        onLogin(result.token, result.party)
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      {/* Hero */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold gradient-text">XDC Privacy</h1>
        <p className="mt-2 text-gray-600">
          Privacy layer for XDC Network
        </p>
      </div>

      {/* Key Warning for Registration */}
      {registrationKeys && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">
                Save Your Private Keys!
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                These keys cannot be recovered. Store them securely.
              </p>
              <div className="mt-3 space-y-2">
                <div>
                  <label className="text-xs text-amber-600">Identity Key:</label>
                  <code className="block text-xs bg-amber-100 p-2 rounded overflow-x-auto">
                    {registrationKeys.identityPrivateKey}
                  </code>
                </div>
                <div>
                  <label className="text-xs text-amber-600">Encryption Key:</label>
                  <code className="block text-xs bg-amber-100 p-2 rounded overflow-x-auto">
                    {registrationKeys.encryptionPrivateKey}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Form */}
      <div className="bg-white shadow-lg rounded-xl p-8">
        {/* Tabs */}
        <div className="flex mb-6 border-b">
          <button
            className={`flex-1 pb-3 text-sm font-medium ${
              mode === 'login'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 pb-3 text-sm font-medium ${
              mode === 'register'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your name or organization"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            <KeyIcon className="w-3 h-3 inline mr-1" />
            A cryptographic key pair will be generated for you
          </p>
        )}
      </div>

      {/* Features */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        <div className="p-3">
          <div className="text-2xl mb-1">🔐</div>
          <div className="text-xs text-gray-600">End-to-End Encrypted</div>
        </div>
        <div className="p-3">
          <div className="text-2xl mb-1">👁️</div>
          <div className="text-xs text-gray-600">Need-to-Know Privacy</div>
        </div>
        <div className="p-3">
          <div className="text-2xl mb-1">⛓️</div>
          <div className="text-xs text-gray-600">On-Chain Commitment</div>
        </div>
      </div>
    </div>
  )
}
