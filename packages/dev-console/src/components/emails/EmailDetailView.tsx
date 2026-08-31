import React from 'react'
import { useEmailDetails } from '../../hooks'
import { getBaseUrl } from '../../utils'

interface EmailDetailViewProps {
  id: string
  onBack: () => void
}

const EmailDetailView: React.FC<EmailDetailViewProps> = ({ id, onBack }) => {
  const { data, isLoading, error } = useEmailDetails(id)
  const email = data?.email

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading email...</div>
      </div>
    )
  }

  if (error || !email) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading email: {error?.message}</div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Emails
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back to Emails
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{email.subject}</h1>
              <p className="text-gray-600">{new Date(email.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <a
            href={`${getBaseUrl()}/console/emails/${email.id}/raw`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
          >
            View raw (.eml)
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">From</label>
            <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">{email.from}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">To</label>
            <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">{email.to.join(', ')}</div>
          </div>
          {email.cc && email.cc.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Cc</label>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">{email.cc.join(', ')}</div>
            </div>
          )}
          {email.configurationSet && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Configuration Set</label>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">{email.configurationSet}</div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
            <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                email.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {email.status}
              </span>
              {email.hasAttachments && (
                <span className="ml-2 text-xs text-gray-500">
                  {email.attachmentCount} attachment{email.attachmentCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {email.error && (
          <div className="mt-4">
            <div className="text-xs font-medium text-red-600 mb-1">Error:</div>
            <div className="text-sm bg-red-50 p-3 rounded border text-red-800">{email.error}</div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Preview</h3>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{email.preview}</p>
      </div>
    </div>
  )
}

export default EmailDetailView
