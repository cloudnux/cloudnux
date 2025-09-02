import React from 'react'
import { Module } from '../../types/api'

interface ModuleCardProps {
  module: Module
  onSelect: () => void
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module, onSelect }) => {
  const totalResources = module.routes.length + module.queues.length + module.schedules.length

  return (
    <div 
      className="group relative bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={onSelect}
    >
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {module.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {module.name}
              </h3>
              <p className="text-sm text-gray-500">
                {totalResources} total resources
              </p>
            </div>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {module.routes.length}
            </div>
            <div className="text-xs font-medium text-green-700 uppercase tracking-wide">
              HTTP Routes
            </div>
          </div>
          
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {module.queues.length}
            </div>
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">
              Event Queues
            </div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {module.schedules.length}
            </div>
            <div className="text-xs font-medium text-purple-700 uppercase tracking-wide">
              Schedules
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Click to explore module</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModuleCard