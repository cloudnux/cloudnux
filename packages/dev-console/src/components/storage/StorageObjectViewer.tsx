import React, { useState } from 'react'
import { StorageObject } from '../../types/api'
import { getBaseUrl } from '../../utils'
import { formatSize } from './StorageTree'

interface StorageObjectViewerProps {
  bucket: string
  object: StorageObject
}

const isImage = (object: StorageObject) =>
  object.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(object.key)

const isPreviewable = (object: StorageObject) =>
  isImage(object) ||
  object.contentType === 'application/pdf' || /\.pdf$/i.test(object.key) ||
  object.contentType?.startsWith('text/') || /\.(txt|json|csv|md|html?|xml|log)$/i.test(object.key)

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

const StorageObjectViewer: React.FC<StorageObjectViewerProps> = ({ bucket, object }) => {
  const url = `${getBaseUrl()}/__storage/${encodeURIComponent(bucket)}/${object.encodedKey}`

  return (
    <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
      <div className="p-4 border-b space-y-3">
        <div className="font-mono text-sm text-gray-900 break-all">{object.key}</div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-gray-500">Encoded key</dt>
          <dd className="font-mono text-gray-800 break-all">{object.encodedKey}</dd>
          <dt className="text-gray-500">Size</dt>
          <dd className="text-gray-800">{formatSize(object.size)}</dd>
          <dt className="text-gray-500">Content type</dt>
          <dd className="text-gray-800">{object.contentType ?? '—'}</dd>
          <dt className="text-gray-500">Modified</dt>
          <dd className="text-gray-800">{new Date(object.lastModified).toLocaleString()}</dd>
        </dl>
        <div className="flex gap-2">
          <CopyButton value={object.encodedKey} label="Copy key" />
          <CopyButton value={url} label="Copy URL" />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Open
          </a>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-gray-50 rounded-b-lg overflow-auto flex items-center justify-center">
        {isImage(object) ? (
          <img src={url} alt={object.key} className="max-w-full max-h-full object-contain p-4" />
        ) : isPreviewable(object) ? (
          <iframe src={url} title={object.key} className="w-full h-full bg-white rounded-b-lg" />
        ) : (
          <div className="text-gray-400 text-sm">No preview for this file type</div>
        )}
      </div>
    </div>
  )
}

export default StorageObjectViewer
