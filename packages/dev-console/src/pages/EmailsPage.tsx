import React from 'react'
import { useNavigate } from 'react-router'
import EmailsListView from '../components/emails/EmailsListView'

const EmailsPage: React.FC = () => {
  const navigate = useNavigate()

  return <EmailsListView onSelect={(id) => navigate(`/emails/${id}`)} />
}

export default EmailsPage
