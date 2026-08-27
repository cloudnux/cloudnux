import React from 'react'
import { useParams, useNavigate } from 'react-router'
import EmailDetailView from '../components/emails/EmailDetailView'

const EmailDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid email id</div>
        <button
          onClick={() => navigate('/emails')}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Emails
        </button>
      </div>
    )
  }

  return <EmailDetailView id={id} onBack={() => navigate('/emails')} />
}

export default EmailDetailPage
