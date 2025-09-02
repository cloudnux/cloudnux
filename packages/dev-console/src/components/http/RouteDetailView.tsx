import React, { useState } from 'react'
import TerminalLogs from '../modules/TerminalLogs'

interface RouteDetailViewProps {
  moduleName: string
  routeUrl: string
  routeMethod: string
  onBack: () => void
}

const RouteDetailView: React.FC<RouteDetailViewProps> = ({ moduleName, routeUrl, routeMethod, onBack }) => {
  const [showEndpoints, setShowEndpoints] = useState(false)
  const [testMethod, setTestMethod] = useState(routeMethod)
  const [testBody, setTestBody] = useState('{}')
  const [testHeaders, setTestHeaders] = useState('{\n  "Content-Type": "application/json"\n}')
  const [testResponse, setTestResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleTestRoute = async () => {
    setIsLoading(true)
    setTestResponse(null)

    try {
      const headers = JSON.parse(testHeaders)
      const requestOptions: RequestInit = {
        method: testMethod,
        headers
      }

      if (testMethod !== 'GET' && testMethod !== 'HEAD') {
        requestOptions.body = testBody
      }

      const startTime = Date.now()
      const response = await fetch(`http://localhost:3000${routeUrl}`, requestOptions)
      const endTime = Date.now()
      
      let responseData
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text()
      }

      setTestResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        duration: endTime - startTime
      })
    } catch (error) {
      setTestResponse({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 0
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-green-100 text-green-800'
      case 'POST': return 'bg-blue-100 text-blue-800'
      case 'PUT': return 'bg-orange-100 text-orange-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      case 'PATCH': return 'bg-purple-100 text-purple-800'
      case 'HEAD': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back to {moduleName}
            </button>
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${getMethodColor(routeMethod)}`}>
                  {routeMethod}
                </span>
                <h1 className="text-2xl font-semibold text-gray-900">{routeUrl}</h1>
              </div>
              <p className="text-gray-600">HTTP Endpoint in {moduleName} module</p>
            </div>
          </div>
        </div>
      </div>

      {/* Route Endpoints Card */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
          onClick={() => setShowEndpoints(!showEndpoints)}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Route Information</h3>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${showEndpoints ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {showEndpoints && (
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Full URL</label>
                <code className="block text-sm font-mono bg-gray-50 p-3 rounded border">
                  http://localhost:3000{routeUrl}
                </code>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Method</label>
                <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${getMethodColor(routeMethod)}`}>
                  {routeMethod}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Module</label>
                <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                  {moduleName}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Route Tester Card */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Test Route</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
              <select
                value={testMethod}
                onChange={(e) => setTestMethod(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Headers</label>
              <textarea
                value={testHeaders}
                onChange={(e) => setTestHeaders(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter headers JSON..."
              />
            </div>

            {testMethod !== 'GET' && testMethod !== 'HEAD' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Request Body</label>
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  className="w-full h-32 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter request body..."
                />
              </div>
            )}

            <button
              onClick={handleTestRoute}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Testing...' : 'Test Route'}
            </button>
          </div>

          {/* Response Display */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Response</label>
              {testResponse ? (
                <div className="border border-gray-300 rounded-md">
                  {/* Response Status */}
                  <div className="p-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                        testResponse.status >= 200 && testResponse.status < 300 ? 'bg-green-100 text-green-800' :
                        testResponse.status >= 400 ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {testResponse.status} {testResponse.statusText}
                      </span>
                      <span className="text-sm text-gray-600">
                        {testResponse.duration}ms
                      </span>
                    </div>
                  </div>

                  {/* Response Headers */}
                  {testResponse.headers && Object.keys(testResponse.headers).length > 0 && (
                    <div className="p-3 border-b border-gray-200">
                      <div className="text-xs font-medium text-gray-600 mb-2">Response Headers:</div>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(testResponse.headers, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Response Body */}
                  <div className="p-3">
                    <div className="text-xs font-medium text-gray-600 mb-2">Response Body:</div>
                    <pre className="text-sm bg-gray-50 p-3 rounded border overflow-x-auto max-h-64">
                      {testResponse.error ? 
                        `Error: ${testResponse.error}` :
                        typeof testResponse.data === 'string' ? 
                          testResponse.data : 
                          JSON.stringify(testResponse.data, null, 2)
                      }
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-md p-8 text-center text-gray-500">
                  Click "Test Route" to see the response
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Route Logs */}
      <TerminalLogs 
        moduleName={moduleName}
        triggerName={routeUrl}
        triggerType="http"
        title={`${routeMethod} ${routeUrl} Logs`}
      />
    </div>
  )
}

export default RouteDetailView