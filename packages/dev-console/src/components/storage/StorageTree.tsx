import React, { useMemo, useState } from 'react'
import { StorageObject } from '../../types/api'

interface FolderNode {
  name: string
  path: string
  folders: FolderNode[]
  files: StorageObject[]
}

interface StorageTreeProps {
  objects: StorageObject[]
  selectedKey?: string
  onSelect: (object: StorageObject) => void
}

/** Turn flat S3-style keys into a folder tree by splitting on `/` */
function buildTree(objects: StorageObject[]): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: [], files: [] }
  for (const object of objects) {
    const parts = object.key.split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      let child = node.folders.find(f => f.name === part)
      if (!child) {
        child = { name: part, path: node.path ? `${node.path}/${part}` : part, folders: [], files: [] }
        node.folders.push(child)
      }
      node = child
    }
    node.files.push(object)
  }
  const sort = (node: FolderNode) => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name))
    node.folders.forEach(sort)
  }
  sort(root)
  return root
}

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FolderIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    {open
      ? <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H6.5a2 2 0 00-1.9 1.4L2 16V6z M4.6 11.4A1 1 0 015.6 11H19l-2.4 5.3a1 1 0 01-.9.7H3l1.6-5.6z" />
      : <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />}
  </svg>
)

const FileIcon: React.FC = () => (
  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const Folder: React.FC<{
  node: FolderNode
  depth: number
  selectedKey?: string
  onSelect: (object: StorageObject) => void
}> = ({ node, depth, selectedKey, onSelect }) => {
  const [open, setOpen] = useState(true)
  const indent = { paddingLeft: `${depth * 16 + 12}px` }

  return (
    <div>
      {node.path && (
        <div
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 py-1.5 pr-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-800"
          style={indent}
        >
          <FolderIcon open={open} />
          <span className="truncate">{node.name}</span>
        </div>
      )}
      {open && (
        <>
          {node.folders.map(folder => (
            <Folder key={folder.path} node={folder} depth={node.path ? depth + 1 : depth} selectedKey={selectedKey} onSelect={onSelect} />
          ))}
          {node.files.map(file => (
            <div
              key={file.key}
              onClick={() => onSelect(file)}
              className={`flex items-center gap-2 py-1.5 pr-3 cursor-pointer text-sm ${
                file.key === selectedKey ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-700'
              }`}
              style={{ paddingLeft: `${(node.path ? depth + 1 : depth) * 16 + 12}px` }}
            >
              <FileIcon />
              <span className="truncate flex-1">{file.key.split('/').pop()}</span>
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatSize(file.size)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

const StorageTree: React.FC<StorageTreeProps> = ({ objects, selectedKey, onSelect }) => {
  const tree = useMemo(() => buildTree(objects), [objects])

  if (objects.length === 0) {
    return <div className="p-8 text-center text-gray-500 text-sm">This bucket is empty</div>
  }

  return (
    <div className="py-2">
      <Folder node={tree} depth={0} selectedKey={selectedKey} onSelect={onSelect} />
    </div>
  )
}

export default StorageTree
