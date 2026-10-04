import React, { useState } from 'react'
import { useEmailDetails, useEmailBody } from '../../hooks'
import { getBaseUrl } from '../../utils'

interface EmailViewerProps {
  id: string
}

type BodyTab = 'html' | 'text'

const EmailViewer: React.FC<EmailViewerProps> = ({ id }) => {
  const { data: detailData, isLoading: detailLoading, error: detailError } = useEmailDetails(id)
  const { data: bodyData, isLoading: bodyLoading } = useEmailBody(id)
  const [tab, setTab] = useState<BodyTab | null>(null)

  const email = detailData?.email
  const body = bodyData?.body
  const activeTab: BodyTab = tab ?? (body?.html ? 'html' : 'text')

  if (detailLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading email...</div>
      </div>
    )
  }

  if (detailError || !email) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading email: {detailError?.message}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 break-words">{email.subject}</h2>
          <a
            href={`${getBaseUrl()}/console/emails/${email.id}/raw`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium whitespace-nowrap"
          >
            Download .eml
          </a>
        </div>
        <div className="mt-2 space-y-1 text-sm">
          <div><span className="text-gray-500">From:</span> <span className="text-gray-900">{email.from}</span></div>
          <div><span className="text-gray-500">To:</span> <span className="text-gray-900">{email.to.join(', ')}</span></div>
          {email.cc && email.cc.length > 0 && (
            <div><span className="text-gray-500">Cc:</span> <span className="text-gray-900">{email.cc.join(', ')}</span></div>
          )}
          <div className="text-gray-500">{new Date(email.timestamp).toLocaleString()}</div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            email.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {email.status}
          </span>
          {email.configurationSet && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              {email.configurationSet}
            </span>
          )}
          {email.hasAttachments && (
            <span className="text-xs text-gray-500">
              {email.attachmentCount} attachment{email.attachmentCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {email.error && (
          <div className="mt-3 text-sm bg-red-50 p-3 rounded border text-red-800">{email.error}</div>
        )}
      </div>

      {body?.html && body?.text && (
        <div className="px-4 pt-3 flex gap-4 border-b">
          {(['html', 'text'] as BodyTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'html' ? 'HTML' : 'Plain text'}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        {bodyLoading ? (
          <div className="p-6 animate-pulse">Loading content...</div>
        ) : activeTab === 'html' && body?.html ? (
          <iframe
            title="Email preview"
            srcDoc={body.html}
            sandbox=""
            className="w-full h-full min-h-[500px] border-0"
          />
        ) : body?.text ? (
          <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans">{body.text}</pre>
        ) : (
          <div className="p-6 text-sm text-gray-500">No body content available</div>
        )}
      </div>
    </div>
  )
}

export default EmailViewer
