import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import {
  getLandingLeadsDashboardStats,
  getLandingLeadsWithExtra,
  getAllSellers,
  getAllCampaigns,
} from '@/lib/services/admin.service'
import { LandingPageView, LandingPageSkeleton } from './LandingPageView'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Landing Leads · Admin',
}

type SearchParams = {
  q?: string
  product?: string
  cons?: 'all' | 'yes' | 'no'
  assign?: 'all' | 'available' | 'assigned'
  status?: string
  from?: string
  to?: string
  zip?: string
  page?: string
  pageSize?: string
  sort?: string
  dir?: 'asc' | 'desc'
}

const statusMap: Record<string, any> = {
  new: 'new',
  assigned: 'assigned',
  contacted: 'contacted',
  callback: 'callback',
  offer: 'offer',
  closed: 'closed',
  no_interest: 'no_interest',
  wrong_data: 'wrong_data',
  canceled: 'canceled',
  archived: 'archived',
}

export default async function AdminLandingLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin()
  const sp = searchParams

  const products = (sp.product ?? '')
    .split(',')
    .filter((x) => x === 'strom' || x === 'gas' || x === 'beides') as ('strom' | 'gas' | 'beides')[]
  const statuses = (sp.status ?? '')
    .split(',')
    .map((x) => statusMap[x])
    .filter(Boolean)

  const [stats, list, sellers, campaigns] = await Promise.all([
    getLandingLeadsDashboardStats(),
    getLandingLeadsWithExtra({
      search: sp.q?.trim(),
      product: products.length > 0 ? products : undefined,
      consultation: sp.cons ?? 'all',
      assignment: sp.assign ?? 'all',
      statuses: statuses.length > 0 ? statuses : undefined,
      from: sp.from,
      to: sp.to,
      zip: sp.zip?.trim(),
      page: sp.page ? Number(sp.page) : undefined,
      pageSize: sp.pageSize ? Number(sp.pageSize) : undefined,
      sortBy: sp.sort,
      sortDir: sp.dir,
    }),
    getAllSellers(),
    getAllCampaigns(),
  ])

  return (
    <Suspense fallback={<LandingPageSkeleton />}>
      <LandingPageView
        stats={stats as any}
        list={list as any}
        sellers={sellers as any[]}
        campaigns={campaigns as any[]}
        initialFilters={{
          q: sp.q ?? '',
          product: products,
          cons: sp.cons ?? 'all',
          assign: sp.assign ?? 'all',
          status: (sp.status ?? '').split(',').filter(Boolean),
          from: sp.from ?? '',
          to: sp.to ?? '',
          zip: sp.zip ?? '',
          page: sp.page ? Number(sp.page) : 1,
          pageSize: sp.pageSize ? Number(sp.pageSize) : 25,
          sort: sp.sort ?? '',
          dir: sp.dir ?? 'desc',
        }}
      />
    </Suspense>
  )
}
