import React, { useEffect, useState } from 'react'
import { LockKeyhole, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase'

function isRecoveryLink() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return hash.get('type') === 'recovery'
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [membership, setMembership] = useState({ state: 'checking' })
  const [authView, setAuthView] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [feedbackKind, setFeedbackKind] = useState('error')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setMessage(error.message)
      setSession(data?.session ?? null)
      if (isRecoveryLink() && data?.session) setAuthView('password')
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setReady(true)
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('password')
        setMessage('')
      } else if (event !== 'SIGNED_OUT') {
        setMessage('')
      }
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
    setBusy(true); setMessage(''); setFeedbackKind('error')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage(error.message)
    } catch (error) { setMessage(error.message || 'Não foi possível conectar ao Supabase.') }
    finally { setBusy(false) }
  }

  async function requestPasswordReset(event) {
    event.preventDefault()
    setBusy(true); setMessage(''); setFeedbackKind('error')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })
      if (error) setMessage(error.message)
      else {
        setFeedbackKind('success')
        setMessage('Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.')
      }
    } catch (error) { setMessage(error.message || 'Não foi possível solicitar a redefinição.') }
    finally { setBusy(false) }
  }

  async function updatePassword(event) {
    event.preventDefault()
    setMessage(''); setFeedbackKind('error')
    if (newPassword.length < 8) {
      setMessage('Use uma senha com pelo menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('As senhas não coincidem.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMessage(error.message)
        return
      }
      setAuthView('login')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await supabase.auth.signOut()
      setFeedbackKind('success')
      setMessage('Senha alterada. Entre com sua nova senha.')
    } catch (error) { setMessage(error.message || 'Não foi possível atualizar a senha.') }
    finally { setBusy(false) }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setMessage(error.message)
  }

  if (!isSupabaseConfigured) return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><div className="eyebrow">CENTRAL DE INTELIGÊNCIA E INOVAÇÃO</div><h1>NEXUS temporariamente indisponível</h1><p>Não foi possível conectar ao espaço de trabalho. O ambiente de publicação precisa estar configurado para acessar o Supabase.</p><div className="auth-callout"><LockKeyhole size={17}/> Se você administra o NEXUS, confira as variáveis de conexão Supabase no projeto da Vercel e publique um novo deploy.</div></section></div>
  if (!ready) return <AuthMessage title="Conectando ao NEXUS" text="Verificando sua sessão segura…"/>

  if (authView === 'password') {
    if (!session) return <AuthMessage title="Validando link de recuperação" text="Aguarde enquanto confirmamos o acesso seguro para trocar sua senha…"/>
    return <AuthCard eyebrow="RECUPERAÇÃO DE ACESSO" title="Crie uma nova senha" description="Escolha uma senha nova para sua conta do NEXUS.">
      <form onSubmit={updatePassword}>
        <label className="field-label">Nova senha<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Pelo menos 8 caracteres"/></label>
        <label className="field-label">Confirme a nova senha<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente"/></label>
        {message&&<div className="auth-error">{message}</div>}
        <button className="primary-button auth-submit" disabled={busy}><LockKeyhole size={16}/>{busy?'Salvando…':'Salvar nova senha'}</button>
      </form>
    </AuthCard>
  }

  if (!session && authView === 'recover') return <AuthCard eyebrow="RECUPERAÇÃO DE ACESSO" title="Redefinir senha" description="Informe seu e-mail e enviaremos um link para criar uma nova senha.">
    <form onSubmit={requestPasswordReset}>
      <label className="field-label">E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/></label>
      {message&&<div className={feedbackKind==='success'?'auth-success':'auth-error'}>{message}</div>}
      <button className="primary-button auth-submit" disabled={busy}><LogIn size={16}/>{busy?'Enviando…':'Enviar link de redefinição'}</button>
      <button type="button" className="auth-text-button" onClick={()=>{setAuthView('login');setMessage('')}}>Voltar para entrar</button>
    </form>
  </AuthCard>

  if (!session) return <AuthCard eyebrow="ESPAÇO INSTITUCIONAL" title="Entrar no NEXUS" description="Use o acesso fornecido pelo administrador do sistema.">
    <form onSubmit={signIn}>
      <label className="field-label">E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/></label>
      <label className="field-label">Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/></label>
      {message&&<div className={feedbackKind==='success'?'auth-success':'auth-error'}>{message}</div>}
      <button className="primary-button auth-submit" disabled={busy}><LogIn size={16}/>{busy?'Entrando…':'Entrar'}</button>
      <button type="button" className="auth-text-button" onClick={()=>{setAuthView('recover');setMessage('')}}>Esqueci minha senha</button>
      <div className="auth-foot"><ShieldCheck size={15}/> Acesso restrito a membros autorizados.</div>
    </form>
  </AuthCard>

  if (membership.state === 'checking') return <AuthMessage title="Validando acesso" text="Conferindo sua autorização para este espaço…"/>
  if (membership.state === 'error') return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><h1>Não foi possível validar seu acesso</h1><p>{membership.message}</p><button className="secondary-button" onClick={signOut}><LogOut size={15}/> Sair</button></section></div>
  if (membership.state !== 'allowed') return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><h1>Acesso ainda não autorizado</h1><p>Sua conta existe, mas ainda não foi adicionada à lista de membros do NEXUS. Peça ao administrador para liberar seu acesso.</p><button className="secondary-button" onClick={signOut}><LogOut size={15}/> Sair</button></section></div>
  return children(session.user, signOut)
}

function AuthCard({ eyebrow, title, description, children }) {
  return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">N</div><span><b>NEXUS</b><small>SINDPETSHOP-SP</small></span></div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p>{children}</section></div>
}

function AuthMessage({ title, text }) {
  return <div className="auth-shell"><section className="auth-card auth-loading"><div className="brand-mark">N</div><h1>{title}</h1><p>{text}</p></section></div>
}
