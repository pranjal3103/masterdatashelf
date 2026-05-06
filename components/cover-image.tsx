'use client'

import { useState } from 'react'
import Image from 'next/image'

type Props = {
  src: string | null
  title: string
  // Applied to the wrapper div — must include sizing (e.g. "w-full aspect-[2/3]")
  className?: string
  sizes?: string
}

export default function CoverImage({
  src,
  title,
  className = 'w-full aspect-[2/3]',
  sizes = '(max-width: 640px) 100vw, 176px',
}: Props) {
  const [err, setErr] = useState(false)

  if (!src || err) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden ${className}`}
        style={{ backgroundColor: '#E8E0D5' }}
      >
        <p className="text-sm text-gray-500 p-4 text-center leading-snug">{title}</p>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={title}
        fill
        sizes={sizes}
        className="object-cover"
        onError={() => setErr(true)}
      />
    </div>
  )
}
