import React from 'react'
import { useNavigate, useParams } from 'react-router'
import EmailsListView from '../components/emails/EmailsListView'
import EmailViewer from '../components/emails/EmailViewer'

const EmailsPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Emails</h1>
        <p className="text-gray-600">Sent via the local email provider</p>
      </div>

      <div className="flex gap-6 items-start" style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>
        <div className="w-full max-w-sm shrink-0 h-full">
          <EmailsListView selectedId={id} onSelect={(emailId) => navigate(`/emails/${emailId}`)} />
        </div>
        <div className="flex-1 min-w-0 h-full">
          {id ? (
            <EmailViewer id={id} />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border h-full flex items-center justify-center text-gray-400 text-sm">
              Select an email to preview it
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailsPage
