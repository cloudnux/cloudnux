import React from 'react'
import { useEmails } from '../../hooks'
import { EmailHistoryEntry } from '../../types/api'

interface EmailsListViewProps {
  onSelect: (id: string) => void
}

const PaperclipIcon: React.FC = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 10-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
)

const StatusBadge: React.FC<{ status: EmailHistoryEntry['status'] }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
    status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`}>
    {status}
  </span>
)

const EmailsListView: React.FC<EmailsListViewProps> = ({ onSelect }) => {
  const { data, isLoading, error } = useEmails()
  const emails = data?.emails ?? []

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading emails...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading emails: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Emails</h1>
        <p className="text-gray-600">Last {emails.length} sent via the local email provider</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {emails.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No emails sent yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {emails.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onSelect(entry.id)}
                className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={entry.status} />
                    <span className="text-sm font-medium text-gray-900 truncate">{entry.from}</span>
                    {entry.hasAttachments && <PaperclipIcon />}
                    {entry.configurationSet && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 truncate">
                        {entry.configurationSet}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-900 truncate mt-1">{entry.subject}</div>
                  <div className="text-sm text-gray-500 truncate">{entry.preview}</div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EmailsListView
