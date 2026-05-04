import ImportCSV from './import-csv'

export default function SettingsPage() {
  return (
    <main className="p-6 md:p-8">
      <h1 className="text-2xl font-serif text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-8">Manage your library data</p>

      <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm max-w-2xl">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Import from Goodreads</h2>
        <p className="text-sm text-gray-400 mb-6">
          Export your library from Goodreads (My Books → Import/Export → Export Library) and upload the CSV here.
          Re-importing is safe — existing books are updated, not duplicated.
        </p>
        <ImportCSV />
      </section>
    </main>
  )
}
