import React, { useEffect, useState } from 'react'
import { LockKeyhole, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase'

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [membership, setMembership] = useState({ state: 'checking' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setMessage(error.message)
      setSession(data?.session ?? null)
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setReady(true)
      setMessage('')
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setMembership({ state: session ? 'denied' : 'checking' })
      return
    }
    let active = true
    setMembership({ state: 'checking' })
    supabase.from('nexus_members').select('role').eq('user_id', session.user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) setMembership({ state: 'error', message: error.message })
      else if (data) setMembership({ state: 'allowed', role: data.role })
      else setMembership({ state: 'denied' })
    })
    return () => { active = false }
  }, [session?.user?.id])

  async function signIn(event) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage(error.message)
    } catch (error) { setMessage(error.message || 'Não foi possível conectar ao Supabase.') }
    finally { setBusy(false) }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setMessage(error.message)
  }

  if (!isSupabaseConfigured) return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><div className="eyebrow">CENTRAL DE INTELIGÊNCIA E INOVAÇÃO</div><h1>NEXUS temporariamente indisponível</h1><p>Não foi possível conectar ao espaço de trabalho. O ambiente de publicação precisa estar configurado para acessar o Supabase.</p><div className="auth-callout"><LockKeyhole size={17}/> Se você administra o NEXUS, confira as variáveis de conexão Supabase no projeto da Vercel e publique um novo deploy.</div></section></div>
  if (!ready) return <AuthMessage title="Conectando ao NEXUS" text="Verificando sua sessão segura…"/>
  if (!session) return <div className="auth-shell"><form className="auth-card" onSubmit={signIn}><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><div className="eyebrow">ESPAÇO INSTITUCIONAL</div><h1>Entrar no NEXUS</h1><p>Use o acesso fornecido pelo administrador do sistema.</p><label className="field-label">E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/></label><label className="field-label">Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/></label>{message&&<div className="auth-error">{message}</div>}<button className="primary-button auth-submit" disabled={busy}><LogIn size={16}/>{busy?'Entrando…':'Entrar'}</button><div className="auth-foot"><ShieldCheck size={15}/> Acesso restrito a membros autorizados.</div></form></div>
  if (membership.state === 'checking') return <AuthMessage title="Validando acesso" text="Conferindo sua autorização para este espaço…"/>
  if (membership.state === 'error') return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><h1>Não foi possível validar seu acesso</h1><p>{membership.message}</p><button className="secondary-button" onClick={signOut}><LogOut size={15}/> Sair</button></section></div>
  if (membership.state !== 'allowed') return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><h1>Acesso ainda não autorizado</h1><p>Sua conta existe, mas ainda não foi adicionada à lista de membros do NEXUS. Peça ao administrador para liberar seu acesso.</p><button className="secondary-button" onClick={signOut}><LogOut size={15}/> Sair</button></section></div>
  return children(session.user, signOut)
}

function AuthMessage({ title, text }) {
  return <div className="auth-shell"><section className="auth-card auth-loading"><div className="brand-mark">N</div><h1>{title}</h1><p>{text}</p></section></div>
}
