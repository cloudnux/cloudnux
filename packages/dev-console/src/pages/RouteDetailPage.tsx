import React from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import RouteDetailView from '../components/http/RouteDetailView'

const RouteDetailPage: React.FC = () => {
  const { moduleName } = useParams<{ moduleName: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const routeUrl = searchParams.get('url')
  const routeMethod = searchParams.get('method')

  const handleBack = () => {
    navigate(`/modules/${moduleName}`)
  }

  if (!moduleName || !routeUrl || !routeMethod) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid route parameters</div>
        <button
          onClick={() => navigate('/modules')}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Modules
        </button>
      </div>
    )
  }

  return (
    <RouteDetailView
      moduleName={moduleName}
      routeUrl={decodeURIComponent(routeUrl)}
      routeMethod={routeMethod}
      onBack={handleBack}
    />
  )
}

export default RouteDetailPage