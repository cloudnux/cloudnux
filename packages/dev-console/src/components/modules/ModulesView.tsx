import React from 'react'
import { useModules } from '../../hooks'
import ModuleCard from './ModuleCard'

interface ModulesViewProps {
  onModuleSelect: (moduleName: string) => void
}

const ModulesView: React.FC<ModulesViewProps> = ({ onModuleSelect }) => {
  const { data: modulesData, isLoading, error } = useModules()

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading modules...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading modules: {error.message}</div>
      </div>
    )
  }

  const modules = modulesData?.modules || []

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Your Modules
        </h1>
        <p className="text-gray-600">
          Explore and manage your CloudNux modules
        </p>
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No modules found</h3>
          <p className="text-gray-500 mb-4">Deploy some modules to see them here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {modules.map((module) => (
            <ModuleCard 
              key={module.name} 
              module={module} 
              onSelect={() => onModuleSelect(module.name)} 
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ModulesView