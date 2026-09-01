import React from 'react'
import { useNavigate } from 'react-router'
import TopicsListView from '../components/topics/TopicsListView'

const TopicsPage: React.FC = () => {
  const navigate = useNavigate()

  return <TopicsListView onSelect={(name) => navigate(`/topics/${name}`)} />
}

export default TopicsPage
