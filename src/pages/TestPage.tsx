import { useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testBackend = async () => {
    setLoading(true)
    setResult('Проверяю подключение к backend...')

    try {
      console.log('[TEST] Calling /api/health...')
      const response = await fetch('/api/health')
      console.log('[TEST] Response status:', response.status)

      const data = await response.json()
      console.log('[TEST] Response data:', data)

      setResult(`✅ Backend работает!\n\n${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      console.error('[TEST] Error:', error)
      setResult(`❌ Ошибка подключения к backend:\n\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const testDirect = async () => {
    setLoading(true)
    setResult('Проверяю прямое подключение к backend на порту 3000...')

    try {
      console.log('[TEST] Calling http://localhost:3000/api/health...')
      const response = await fetch('http://localhost:3000/api/health')
      console.log('[TEST] Response status:', response.status)

      const data = await response.json()
      console.log('[TEST] Response data:', data)

      setResult(`✅ Backend доступен напрямую!\n\n${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      console.error('[TEST] Error:', error)
      setResult(`❌ Backend недоступен на порту 3000:\n\n${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Тест подключения к Backend</h1>

        <div className="bg-white rounded-lg p-6 shadow-md mb-4">
          <h2 className="text-xl font-semibold mb-4">Шаг 1: Проверьте что backend запущен</h2>
          <p className="mb-4 text-gray-600">
            Убедитесь, что вы запустили: <code className="bg-gray-200 px-2 py-1 rounded">npm run dev</code>
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md mb-4">
          <h2 className="text-xl font-semibold mb-4">Шаг 2: Тест через прокси</h2>
          <p className="mb-4 text-gray-600">
            Проверяем подключение через Vite прокси на /api/health
          </p>
          <button
            onClick={testBackend}
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Проверяю...' : 'Тест через прокси'}
          </button>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md mb-4">
          <h2 className="text-xl font-semibold mb-4">Шаг 3: Прямой тест</h2>
          <p className="mb-4 text-gray-600">
            Проверяем прямое подключение к backend на localhost:3000
          </p>
          <button
            onClick={testDirect}
            disabled={loading}
            className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Проверяю...' : 'Тест напрямую'}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold mb-4">Результат:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto whitespace-pre-wrap">
              {result}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
