import { openDB } from 'idb'
import { isSupabaseConfigured, supabase } from './supabase'

export const stores = ['opportunities', 'ideas', 'evaluations', 'projects', 'research', 'knowledge']
const LEGACY_DB_NAME = 'nexus-sindpetshop'
const LEGACY_DB_VERSION = 1

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Conexão do Supabase não configurada. Confira as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')
  return supabase
}

async function currentUserId(client) {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
  return data.user.id
}

export async function all(entity) {
  const client = requireSupabase()
  const { data, error } = await client.from('nexus_records').select('data').eq('entity', entity).order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => row.data)
}

export async function put(entity, record) {
  const client = requireSupabase()
  const userId = await currentUserId(client)
  const { error } = await client.from('nexus_records').upsert({
    id: record.id,
    entity,
    data: record,
    created_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) throw error
  return record
}

export async function remove(entity, id) {
  const client = requireSupabase()
  const { error } = await client.from('nexus_records').delete().eq('id', id).eq('entity', entity)
  if (error) throw error
}

export async function clearAll() {
  const client = requireSupabase()
  const { error } = await client.from('nexus_records').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}

export async function exportAll() {
  const data = Object.fromEntries(await Promise.all(stores.map(async name => [name, await all(name)])))
  return { app: 'NEXUS', schemaVersion: 1, exportedAt: new Date().toISOString(), data }
}

export async function importAll(payload, mode = 'merge') {
  if (!payload || payload.app !== 'NEXUS' || !payload.data || typeof payload.data !== 'object') throw new Error('Este arquivo não parece ser um backup válido do NEXUS.')
  const valid = {}
  for (const name of stores) {
    const rows = payload.data[name] ?? []
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string')) throw new Error(`A lista “${name}” contém registros inválidos.`)
    valid[name] = rows
  }
  if (mode === 'replace') await clearAll()
  for (const name of stores) for (const row of valid[name]) await put(name, row)
}

export async function storageInfo() {
  const client = requireSupabase()
  const { count, error } = await client.from('nexus_records').select('*', { count: 'exact', head: true })
  if (error) throw error
  return { provider: 'Supabase', recordCount: count ?? 0, connected: true }
}

function openLegacyDatabase() {
  return openDB(LEGACY_DB_NAME, LEGACY_DB_VERSION, {
    upgrade(db) {
      for (const name of stores) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
    },
  })
}

export async function legacyLocalData() {
  if (!globalThis.indexedDB) return Object.fromEntries(stores.map(name => [name, []]))
  if (typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases()
    if (!databases.some(item => item.name === LEGACY_DB_NAME)) return Object.fromEntries(stores.map(name => [name, []]))
  }
  const db = await openLegacyDatabase()
  try {
    return Object.fromEntries(await Promise.all(stores.map(async name => [name, await db.getAll(name)])))
  } finally {
    db.close()
  }
}

export async function importLegacyLocal() {
  const data = await legacyLocalData()
  const total = Object.values(data).reduce((sum, rows) => sum + rows.length, 0)
  if (!total) return 0
  for (const name of stores) for (const record of data[name]) await put(name, record)
  return total
}
