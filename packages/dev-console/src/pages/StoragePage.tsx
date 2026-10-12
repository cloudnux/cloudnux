import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useStorageBuckets, useStorageObjects } from '../hooks'
import { StorageObject } from '../types/api'
import StorageTree from '../components/storage/StorageTree'
import StorageObjectViewer from '../components/storage/StorageObjectViewer'

const StoragePage: React.FC = () => {
  const navigate = useNavigate()
  const { bucket } = useParams<{ bucket: string }>()
  const [selected, setSelected] = useState<StorageObject | undefined>()

  const buckets = useStorageBuckets()
  const objects = useStorageObjects(bucket ?? '')

  // Reset the selection when switching bucket, and drop it if the object was deleted
  useEffect(() => setSelected(undefined), [bucket])
  useEffect(() => {
    if (selected && objects.data && !objects.data.objects.some(o => o.key === selected.key)) {
      setSelected(undefined)
    }
  }, [objects.data, selected])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Storage</h1>
        <p className="text-gray-600">Buckets of the local storage provider, served under <code className="font-mono text-sm">/__storage/&lt;bucket&gt;/&lt;key&gt;</code></p>
      </div>

      <div className="flex gap-6 items-start" style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>
        {/* Buckets */}
        <div className="w-56 shrink-0 h-full bg-white rounded-lg shadow-sm border overflow-y-auto">
          <div className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wide text-gray-500">Buckets</div>
          {buckets.isLoading ? (
            <div className="p-4 animate-pulse text-sm">Loading...</div>
          ) : buckets.error ? (
            <div className="p-4 text-sm text-red-600">{buckets.error.message}</div>
          ) : (buckets.data?.buckets ?? []).length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No buckets yet</div>
          ) : (
            buckets.data!.buckets.map(b => (
              <div
                key={b.name}
                onClick={() => navigate(`/storage/${encodeURIComponent(b.name)}`)}
                className={`px-4 py-2 text-sm cursor-pointer truncate ${
                  b.name === bucket ? 'bg-blue-50 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {b.name}
              </div>
            ))
          )}
        </div>

        {/* Objects tree */}
        <div className="w-full max-w-sm shrink-0 h-full bg-white rounded-lg shadow-sm border overflow-y-auto">
          {!bucket ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">Select a bucket</div>
          ) : objects.isLoading ? (
            <div className="p-4 animate-pulse text-sm">Loading objects...</div>
          ) : objects.error ? (
            <div className="p-4 text-sm text-red-600">{objects.error.message}</div>
          ) : (
            <StorageTree objects={objects.data?.objects ?? []} selectedKey={selected?.key} onSelect={setSelected} />
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 min-w-0 h-full">
          {bucket && selected ? (
            <StorageObjectViewer bucket={bucket} object={selected} />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border h-full flex items-center justify-center text-gray-400 text-sm">
              Select a file to preview it
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StoragePage
