'use client'

import { ShieldCheckIcon } from '@heroicons/react/24/outline'

interface NavigationProps {
  party: any | null
  onLogout: () => void
}

export function Navigation({ party, onLogout }: NavigationProps) {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold gradient-text">
              XDC Privacy
            </span>
          </div>
          
          {party && (
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="text-gray-500">Signed in as</span>
                <span className="ml-2 font-medium text-gray-900">{party.name}</span>
              </div>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
