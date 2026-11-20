import React, { useMemo, useState } from 'react'
import {
  useAddStorageNotificationRule,
  useDeleteStorageNotificationRule,
  useQueues,
  useStorageBuckets,
  useStorageNotificationRules,
  useTopics,
} from '../../hooks'
import { StorageNotificationRule } from '../../types/api'

const emptyForm = {
  bucket: '',
  prefix: '',
  suffix: '',
  /** "queue:<name>" or "topic:<name>" */
  target: '',
}

/**
 * Local counterpart of S3 event notifications: when an object is created in a
 * bucket (upload through a signed URL or storage.write()), a message is sent
 * to a queue or published to a topic.
 */
const StorageNotifications: React.FC<{ defaultBucket?: string }> = ({ defaultBucket }) => {
  const rules = useStorageNotificationRules()
  const buckets = useStorageBuckets()
  const queues = useQueues()
  const topics = useTopics()
  const addRule = useAddStorageNotificationRule()
  const deleteRule = useDeleteStorageNotificationRule()
  const [form, setForm] = useState(emptyForm)

  const bucketNames = useMemo(() => (buckets.data?.buckets ?? []).map(b => b.name), [buckets.data])
  const topicNames = useMemo(() => (topics.data?.topics ?? []).map(t => t.name).sort(), [topics.data])
  // Topic subscriber queues are internal to their topic; target the topic instead
  const queueNames = useMemo(() => {
    const subscriberQueues = new Set((topics.data?.topics ?? []).flatMap(t => t.subscribers.map(s => s.queueName)))
    return (queues.data?.queues ?? []).map(q => q.name).filter(name => !subscriberQueues.has(name)).sort()
  }, [queues.data, topics.data])

  const bucket = form.bucket || (defaultBucket && bucketNames.includes(defaultBucket) ? defaultBucket : '')

  const set = (field: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [field]: e.target.value })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const [targetType, ...rest] = form.target.split(':')
    const rule: StorageNotificationRule = {
      bucket,
      prefix: form.prefix || undefined,
      suffix: form.suffix || undefined,
      events: ['created'],
      [targetType]: rest.join(':'),
    }
    addRule.mutate(rule, { onSuccess: () => setForm(emptyForm) })
  }

  const input = 'border rounded px-2 py-1 text-sm w-full'

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        <p className="text-sm text-gray-600">
          When an object is created, send a message to a queue or topic, like S3 event notifications.
          Read it in the handler with <code className="font-mono text-xs">storage.parseObjectCreated(ctx.message())</code>.
        </p>
      </div>

      {rules.isLoading ? (
        <div className="p-4 animate-pulse text-sm">Loading...</div>
      ) : rules.error ? (
        <div className="p-4 text-sm text-red-600">{rules.error.message}</div>
      ) : (rules.data?.rules ?? []).length === 0 ? (
        <div className="px-6 py-4 text-sm text-gray-500">No rules yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-6 py-2">Id</th>
              <th className="px-2 py-2">Bucket</th>
              <th className="px-2 py-2">Prefix</th>
              <th className="px-2 py-2">Suffix</th>
              <th className="px-2 py-2">Target</th>
              <th className="px-6 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.data!.rules.map(rule => (
              <tr key={rule.id} className="border-t">
                <td className="px-6 py-2 font-mono">{rule.id}</td>
                <td className="px-2 py-2">{rule.bucket}</td>
                <td className="px-2 py-2 font-mono">{rule.prefix ?? ''}</td>
                <td className="px-2 py-2 font-mono">{rule.suffix ?? ''}</td>
                <td className="px-2 py-2">
                  {rule.queue ? <>queue <span className="font-mono">{rule.queue}</span></> : <>topic <span className="font-mono">{rule.topic}</span></>}
                </td>
                <td className="px-6 py-2 text-right">
                  <button
                    className="text-red-600 hover:underline disabled:opacity-50"
                    disabled={deleteRule.isPending}
                    onClick={() => rule.id && deleteRule.mutate(rule.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={submit} className="px-6 py-4 border-t grid grid-cols-5 gap-2 items-end">
        <label className="text-xs text-gray-600">Bucket
          <select className={input} value={bucket} onChange={set('bucket')} required>
            <option value="" disabled>{bucketNames.length ? 'Choose a bucket' : 'No buckets yet'}</option>
            {bucketNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">Prefix
          <input className={input} value={form.prefix} onChange={set('prefix')} placeholder="uploads/" />
        </label>
        <label className="text-xs text-gray-600">Suffix
          <input className={input} value={form.suffix} onChange={set('suffix')} placeholder=".pdf" />
        </label>
        <label className="text-xs text-gray-600">Target
          <select className={input} value={form.target} onChange={set('target')} required>
            <option value="" disabled>{queueNames.length || topicNames.length ? 'Choose a queue or topic' : 'No queues or topics yet'}</option>
            {queueNames.length > 0 && (
              <optgroup label="Queues">
                {queueNames.map(name => <option key={`q-${name}`} value={`queue:${name}`}>{name}</option>)}
              </optgroup>
            )}
            {topicNames.length > 0 && (
              <optgroup label="Topics">
                {topicNames.map(name => <option key={`t-${name}`} value={`topic:${name}`}>{name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
          disabled={addRule.isPending || !bucket || !form.target}
        >
          Add rule
        </button>
        {addRule.error && <div className="col-span-5 text-sm text-red-600">{addRule.error.message}</div>}
        {deleteRule.error && <div className="col-span-5 text-sm text-red-600">{deleteRule.error.message}</div>}
      </form>
    </div>
  )
}

export default StorageNotifications
