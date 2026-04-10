export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="text-center max-w-2xl px-6">
        {/* Logo placeholder */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">StaticsFlow</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Generate on-brand{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
            Meta Ads creatives
          </span>{' '}
          in seconds
        </h1>

        {/* Sub-headline */}
        <p className="text-xl text-gray-500 mb-10">
          Paste your URL. Get your Brand DNA extracted automatically. Generate
          your first creative in under 3 minutes.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <input
            type="url"
            placeholder="https://yourstore.com"
            className="flex-1 max-w-sm px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button className="px-6 py-3 rounded-lg bg-black text-white font-semibold hover:bg-gray-800 transition-colors">
            Extract Brand DNA →
          </button>
        </div>

        {/* Status */}
        <p className="mt-8 text-sm text-gray-400">
          🚧 Coming soon — MVP in development
        </p>
      </div>
    </main>
  )
}
