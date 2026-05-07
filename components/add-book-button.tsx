'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const AddBookModal = dynamic(() => import('./add-book-modal'), { ssr: false })

export default function AddBookButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center text-2xl font-light"
        style={{ backgroundColor: '#04152e' }}
        aria-label="Add a book"
        title="Add a book"
      >
        +
      </button>
      {open && <AddBookModal onClose={() => setOpen(false)} />}
    </>
  )
}
