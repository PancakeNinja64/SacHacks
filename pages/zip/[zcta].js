import { useRouter } from 'next/router'
import useSWR from 'swr'
import ZipDrilldown from '../../components/ZipDrilldown'

const fetcher = (url) => fetch(url).then((response) => response.json())

export default function ZipDetail() {
  const router = useRouter()
  const { zcta } = router.query
  const { data, error } = useSWR('/api/top-zips', fetcher)

  if (error) return <div className="status-screen">Failed to load ZIP details.</div>
  if (!data) return <div className="status-screen">Loading ZIP details...</div>
  if (!zcta) return <div className="status-screen">Loading ZIP...</div>

  const record = data.find((row) => String(row.zcta) === String(zcta))
  if (!record) return <div className="status-screen">ZIP not found: {zcta}</div>

  return <ZipDrilldown record={record} />
}
