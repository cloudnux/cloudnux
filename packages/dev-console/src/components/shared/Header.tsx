import React from 'react'
import { Link } from 'react-router'

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-xl font-semibold text-gray-900">
            CloudNux Dev Console
          </h1>
          <nav className="flex items-center space-x-6">
            <Link to="/modules" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Modules
            </Link>
            <Link to="/emails" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Emails
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header