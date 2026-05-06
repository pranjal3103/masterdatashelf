'use client'

import dynamic from 'next/dynamic'
import type { YearStat } from './reading-chart'

const ReadingChart = dynamic(() => import('./reading-chart'), { ssr: false })

export default function ReadingChartWrapper({ yearStats }: { yearStats: YearStat[] }) {
  return <ReadingChart yearStats={yearStats} />
}
