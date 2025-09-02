import React from 'react'

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16">
          <h1 className="text-xl font-semibold text-gray-900">
            CloudNux Dev Console
          </h1>
        </div>
      </div>
    </header>
  )
}

export default Header