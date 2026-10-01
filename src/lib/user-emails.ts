import { createAdminClient } from './supabase/admin'

/**
 * Liefert eine Map user_id -> email aus auth.users.
 *
 * Hintergrund: `public.users` hat KEINE Spalte `email` – die E-Mail wird
 * ausschließlich in Supabases `auth.users` gespeichert. Damit wir in
 * Oberflächen trotzdem E-Mails anzeigen können (Admin-Seller-Liste,
 * Audit-Logs, Token-Transaktionen etc.), laden wir sie hier via
 * Service-Role-API und cachen sie pro Request kurz.
 */
export async function getUserEmailMap(userIds?: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient()
  const map = new Map<string, string>()

  try {
    let page = 1
    const perPage = 1000
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
      if (error) break
      if (!data?.users?.length) break
      for (const u of data.users) {
        if (u.id && u.email) map.set(u.id, u.email)
      }
      if (data.users.length < perPage) break
      page += 1
      if (page > 50) break
    }
  } catch {
    // Falls Auth-Admin-Zugriff fehlschlägt:
    // Fallback auf leere Map (Oberflächen zeigen dann Fallback `full_name ?? '?'` an).
  }

  // Wenn eine konkrete Liste von IDs übergeben wurde: zusätzlich alle fehlenden
  // IDs einzeln nachladen, falls sie durch Paging nicht erfasst wurden.
  if (userIds?.length) {
    const missing = new Set(userIds.filter((id) => id && !map.has(id)))
    for (const id of missing) {
      try {
        const { data } = await admin.auth.admin.getUserById(id)
        if (data?.user?.email) map.set(id, data.user.email)
      } catch {}
    }
  }

  return map
}

/**
 * Hilfsfunktion: Hängt `email` aus auth.users an jedes Item einer Liste,
 * das entweder direkt eine `id` (User) hat, oder ein verschachteltes
 * `user`-Objekt mit einer `id`.
 */
export function withEmail<T extends Record<string, any> & { id?: string | null }>(
  item: T,
  emailMap: Map<string, string>,
  userKey?: string,
): T & { email?: string | null } {
  const src = userKey ? (item as any)[userKey] : item
  const uid = src?.id
  const email = uid ? emailMap.get(uid) ?? null : null
  if (userKey) {
    return { ...item, [userKey]: { ...src, email } } as any
  }
  return { ...item, email } as any
}
