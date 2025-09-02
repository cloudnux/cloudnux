import React from 'react'
import { useNavigate } from 'react-router'
import ModulesView from '../components/modules/ModulesView'

const ModulesPage: React.FC = () => {
  const navigate = useNavigate()

  const handleModuleSelect = (moduleName: string) => {
    navigate(`/modules/${moduleName}`)
  }

  return <ModulesView onModuleSelect={handleModuleSelect} />
}

export default ModulesPage