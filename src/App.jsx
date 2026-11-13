import React, { useEffect, useMemo, useState } from 'react'
import { Activity, Archive, ArrowDownToLine, ArrowRight, ArrowUpFromLine, BookOpen, BriefcaseBusiness, Check, ChevronDown, CircleHelp, ClipboardList, Copy, Download, Eye, File, FileSearch, FlaskConical, FolderKanban, Gauge, Lightbulb, Menu, Paperclip, Plus, Search, Settings, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { all, attachmentUrl, clearAll, exportAll, importAll, importLegacyLocal, MAX_ATTACHMENT_SIZE, put, remove, removeAttachments, storageInfo, stores, uploadAttachments } from './db'
import AuthGate from './AuthGate'

const categories = ['Relações de trabalho', 'Direito sindical', 'Setor pet', 'Comunicação', 'Marketing', 'Tecnologia', 'Relacionamento empresarial', 'Formação profissional', 'Parcerias', 'Representatividade', 'Gestão institucional', 'Outros']
const statusOptions = {
  opportunities: ['Identificada', 'Em análise', 'Convertida em ideia', 'Arquivada'],
  ideas: ['Nova', 'Em desenvolvimento', 'Em análise', 'Aprovada', 'Rejeitada', 'Arquivada', 'Transformada em projeto'],
  projects: ['Planejamento', 'Em desenvolvimento', 'Em execução', 'Pausado', 'Concluído', 'Cancelado'],
}
const config = {
  opportunities: { title: 'Oportunidades', singular: 'oportunidade', icon: Lightbulb, description: 'Registre sinais, necessidades e possibilidades de atuação.', fields: [['title','Título','text',true],['description','Descrição','textarea'],['category','Categoria','select',false,categories],['source','Fonte da informação','text'],['link','Link de referência','url'],['identifiedAt','Data de identificação','date'],['problem','Problema ou oportunidade','textarea'],['audience','Público potencialmente beneficiado','text'],['relevance','Relevância institucional','textarea'],['unionAction','Possibilidade de atuação do sindicato','textarea'],['status','Status','select',false,statusOptions.opportunities],['notes','Observações','textarea']] },
  ideas: { title: 'Biblioteca de ideias', singular: 'ideia', icon: Lightbulb, description: 'Organize ideias e acompanhe o que precisa acontecer em seguida.', fields: [['title','Nome da ideia','text',true],['description','Descrição','textarea'],['problem','Problema que pretende resolver','textarea'],['objective','Objetivo','textarea'],['category','Categoria','select',false,categories],['origin','Origem','text'],['priority','Prioridade','select',false,['Baixa','Média','Alta']],['status','Status','select',false,statusOptions.ideas],['analysis','Resultado da análise de viabilidade','textarea'],['notes','Observações','textarea']] },
  projects: { title: 'Projetos', singular: 'projeto', icon: FolderKanban, description: 'Transforme ideias em iniciativas com escopo e etapas claros.', fields: [['title','Nome do projeto','text',true],['objective','Objetivo geral','textarea'],['justification','Justificativa','textarea'],['problem','Problema que pretende resolver','textarea'],['audience','Público-alvo','text'],['benefits','Benefícios esperados','textarea'],['scope','Escopo','textarea'],['resources','Recursos necessários','textarea'],['costs','Custos estimados','text'],['deadline','Prazo estimado','text'],['indicators','Indicadores de resultado','textarea'],['risks','Riscos','textarea'],['status','Status','select',false,statusOptions.projects],['notes','Observações','textarea']] },
  research: { title: 'Radar de pesquisa', singular: 'pesquisa', icon: FileSearch, description: 'Guarde perguntas, fontes e descobertas relevantes.', fields: [['title','Tema','text',true],['question','Pergunta investigada','textarea'],['source','Fonte','text'],['link','Link','url'],['date','Data','date'],['summary','Resumo','textarea'],['findings','Principais descobertas','textarea'],['opportunities','Oportunidades identificadas','textarea'],['related','Relacionado a (oportunidade, ideia ou projeto)','text'],['notes','Observações','textarea']] },
  knowledge: { title: 'Base de conhecimento', singular: 'referência', icon: BookOpen, description: 'Consulte iniciativas existentes antes de abrir uma nova frente.', fields: [['title','Nome','text',true],['description','Descrição','textarea'],['category','Categoria','select',false,['Sistema institucional','Projeto','Ferramenta','Parceria','CCT','Comunicação','Outro']],['objective','Objetivo','textarea'],['status','Situação atual','text'],['related','Relação com outros projetos','textarea'],['notes','Observações','textarea'],['link','Link de referência','url']] },
}
const navItems = [
  ['dashboard','Dashboard',Gauge],['opportunities','Oportunidades',Lightbulb],['lab','Laboratório de ideias',FlaskConical],['ideas','Biblioteca de ideias',Sparkles],['evaluation','Análise de viabilidade',ClipboardList],['projects','Projetos',FolderKanban],['research','Radar de pesquisa',FileSearch],['knowledge','Base de conhecimento',BookOpen],['settings','Configurações',Settings],
]
const blank = (fields) => Object.fromEntries(fields.map(([key]) => [key, key === 'identifiedAt' || key === 'date' ? new Date().toISOString().slice(0,10) : key === 'status' ? '' : '']))
const dateText = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const uid = () => crypto.randomUUID()

function App() { return <AuthGate>{(user,onSignOut)=><Workspace user={user} onSignOut={onSignOut}/>}</AuthGate> }

function Workspace({user,onSignOut}) {
  const [data,setData] = useState(Object.fromEntries(stores.map(s=>[s,[]])))
  const [page,setPage] = useState('dashboard')
  const [editing,setEditing] = useState(null)
  const [viewing,setViewing] = useState(null)
  const [query,setQuery] = useState('')
  const [modal,setModal] = useState(false)
  const [notice,setNotice] = useState('')
  const [storage,setStorage] = useState(null)
  const [mobileMenu,setMobileMenu] = useState(false)
  const [promptIdea,setPromptIdea] = useState({problem:'',context:'',audience:'',constraints:''})
  const [prompt,setPrompt] = useState('')
  const [aiReply,setAiReply] = useState('')
  const [evalIdea,setEvalIdea] = useState('')

  async function refresh() {
    const entries = await Promise.all(stores.map(async s => [s, await all(s)]))
    setData(Object.fromEntries(entries))
    setStorage(await storageInfo())
  }
  useEffect(()=>{ refresh().catch(e=>toast(e.message)) },[])
  function toast(message){ setNotice(message); window.setTimeout(()=>setNotice(''),3500) }
  const current = navItems.find(([id])=>id===page)
  const records = config[page] ? data[page] : []
  const visible = useMemo(()=>records.filter(row=>JSON.stringify(row).toLowerCase().includes(query.toLowerCase())),[records,query])

  async function saveRecord(store, record, pendingFiles=[], removedFiles=[]) {
    const saved = {...record, id:record.id||uid(), updatedAt:new Date().toISOString(), createdAt:record.createdAt||new Date().toISOString()}
    let uploaded=[]
    try {
      uploaded=await uploadAttachments(store,saved.id,pendingFiles)
      const removedPaths=new Set(removedFiles.map(file=>file.path))
      saved.attachments=[...(record.attachments||[]).filter(file=>!removedPaths.has(file.path)),...uploaded]
      await put(store,saved)
      if(removedFiles.length) await removeAttachments(removedFiles).catch(()=>toast('Registro salvo; um anexo removido não pôde ser apagado do armazenamento.'))
      await refresh(); setModal(false); setEditing(null); setViewing(null); toast('Registro salvo.')
    } catch(error) {
      if(uploaded.length) await removeAttachments(uploaded).catch(()=>{})
      throw error
    }
  }
  async function deleteRecord(store,row) {
    if (!window.confirm(`Excluir “${row.title}”? Essa ação não pode ser desfeita.`)) return
    await removeAttachments(row.attachments||[]); await remove(store,row.id); await refresh(); toast('Registro excluído.')
  }
  function openNew(store=page, seed={}) {
    const fields=config[store]?.fields || []
    setViewing(null); setEditing({...blank(fields), ...seed, attachments:seed.attachments||[], id:seed.id||uid()}); setModal(true)
  }
  function openEdit(store,row) { setViewing(null); setEditing({...row}); setModal(true) }
  async function duplicateIdea(row) { await saveRecord('ideas',{...row,id:'',attachments:[],title:row.title+' (cópia)',status:'Nova',createdAt:'',updatedAt:''}) }
  async function convertOpportunity(row) {
    const exists=data.ideas.some(x=>x.sourceOpportunity===row.id)
    if (exists) return toast('Esta oportunidade já foi convertida em ideia.')
    await saveRecord('ideas',{...blank(config.ideas.fields),title:row.title,description:row.description,problem:row.problem,category:row.category,origin:`Oportunidade: ${row.title}`,status:'Nova',sourceOpportunity:row.id})
    await put('opportunities',{...row,status:'Convertida em ideia'}); await refresh()
    toast('Oportunidade transformada em ideia.')
  }
  async function convertIdea(row) {
    const exists=data.projects.some(x=>x.sourceIdea===row.id)
    if(exists) return toast('Esta ideia já tem um projeto associado.')
    await saveRecord('projects',{...blank(config.projects.fields),title:row.title,objective:row.objective,problem:row.problem,sourceIdea:row.id,status:'Planejamento'})
    await put('ideas',{...row,status:'Transformada em projeto'}); await refresh(); setPage('projects')
  }
  async function makePrompt() {
    const text=`Você é um apoio de planejamento do SindPetshop-SP, sindicato ligado ao setor de pet shops no estado de São Paulo. Ajude a avaliar uma proposta institucional com foco em execução simples e realista. O NEXUS complementa ferramentas e iniciativas já existentes; antes de propor algo, verifique possível sobreposição com as referências fornecidas. Não invente custos, capacidade, dados ou resultados. Separe fatos de hipóteses, aponte informações que faltam e sugira o menor MVP viável. Considere alternativas simples, dependências, riscos jurídicos e operacionais.\n\nPROBLEMA / OPORTUNIDADE\n${promptIdea.problem||'Não informado'}\n\nCONTEXTO\n${promptIdea.context||'Não informado'}\n\nPÚBLICO\n${promptIdea.audience||'Não informado'}\n\nLIMITAÇÕES\n${promptIdea.constraints||'Não informadas'}\n\nREFERÊNCIAS INSTITUCIONAIS CADASTRADAS\n${data.knowledge.map(x=>`- ${x.title}: ${x.description||x.objective||'sem descrição'}`).join('\n')||'Nenhuma referência cadastrada.'}\n\nIDEIAS E PROJETOS RELACIONADOS\n${[...data.ideas,...data.projects].map(x=>`- ${x.title}: ${x.status||'sem status'}`).join('\n')||'Nenhum registro.'}\n\nResponda com: resumo; oportunidade real; opções de solução (inclua a mais simples); MVP; benefícios esperados; recursos/dependências; riscos; pontos desconhecidos; possível sobreposição; próximos passos. Não apresente a resposta como parecer jurídico nem como decisão institucional.`
    setPrompt(text); try {await navigator.clipboard.writeText(text); toast('Prompt gerado e copiado. Você pode colá-lo no ChatGPT ou Claude.')} catch {toast('Prompt gerado. Copie o texto abaixo para usar em um assistente de IA externo.')}
  }
  async function saveReplyAsIdea() {
    await saveRecord('ideas',{...blank(config.ideas.fields),title:promptIdea.problem.slice(0,70)||'Ideia analisada',problem:promptIdea.problem,description:aiReply,origin:'Laboratório de ideias · análise externa por IA',status:'Nova'})
    setAiReply(''); setPrompt(''); setPage('ideas')
  }
  async function saveEvaluation() {
    if(!evalIdea) return toast('Selecione uma ideia para avaliar.')
    const scores=Object.fromEntries(criteria.map(([key])=>[key,Number(document.getElementById(`score-${key}`)?.value||3)]))
    const justifications=Object.fromEntries(criteria.map(([key])=>[key,document.getElementById(`why-${key}`)?.value||'']))
    const score=Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/criteria.length*20)
    const conclusions=Object.fromEntries(conclusionFields.map(([key])=>[key,document.getElementById('conclusion-'+key)?.value||'']))
    const result={id:uid(),ideaId:evalIdea,title:data.ideas.find(i=>i.id===evalIdea)?.title||'Ideia',scores,justifications,score,createdAt:new Date().toISOString(),conclusions}
    await put('evaluations',result); await put('ideas',{...data.ideas.find(i=>i.id===evalIdea),status:'Em análise',analysis:`Avaliação registrada: ${score}/100. Veja os detalhes em Análise de viabilidade.`}); await refresh(); toast('Avaliação registrada.')
  }
  async function exportJSON(){ const payload=await exportAll(); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); download(blob,`nexus-backup-${new Date().toISOString().slice(0,10)}.json`); toast('Backup exportado.') }
  async function importJSON(file){ try { const payload=JSON.parse(await file.text()); const mode=window.confirm('OK: mesclar com os dados atuais. Cancelar: substituir todos os dados pelos do backup.')?'merge':'replace'; if(mode==='replace'&&!window.confirm('Confirme substituir os dados atuais. Esta ação não pode ser desfeita.'))return; await importAll(payload,mode); await refresh(); toast('Backup importado.')} catch(e){toast(e.message||'Não foi possível importar este arquivo.')} }
  async function migrateLegacy(){try{const count=await importLegacyLocal();if(!count)return toast('Não encontrei registros locais da versão anterior.');await refresh();toast(`${count} registro(s) antigo(s) importado(s) para o Supabase.`)}catch(e){toast(e.message||'Não foi possível importar os dados locais.')}}
  async function exportCSV(store){const rows=data[store]; if(!rows.length)return toast('Não há registros para exportar.'); const keys=[...new Set(rows.flatMap(Object.keys))]; const csv=[keys.join(';'),...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`).join(';'))].join('\r\n'); download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),`nexus-${store}.csv`);toast('CSV exportado.')}
  function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu?'open':''}`}>
      <div className="brand"><div className="brand-mark">N</div><div><strong>NEXUS</strong><small>SINDPETSHOP-SP</small></div><button className="mobile-close icon-button" onClick={()=>setMobileMenu(false)} aria-label="Fechar menu"><X size={18}/></button></div>
      <div className="side-label">ESPAÇO DE TRABALHO</div>
      <nav>{navItems.map(([id,label,Icon])=><button key={id} className={`nav-item ${page===id?'active':''}`} onClick={()=>{setPage(id);setQuery('');setMobileMenu(false)}}><Icon size={18}/><span>{label}</span>{id==='dashboard'&&<span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="offline"><span/>Dados sincronizados com Supabase</div><div className="version">NEXUS · Versão inicial</div></div>
    </aside>
    {mobileMenu&&<button className="scrim" onClick={()=>setMobileMenu(false)} aria-label="Fechar menu"/>}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={()=>setMobileMenu(true)} aria-label="Abrir menu"><Menu size={20}/></button><div className="breadcrumbs">SindPetshop-SP <span>/</span> <b>{current?.[1]}</b></div><div className="top-actions"><span className="local-badge"><span/> Supabase conectado</span><span className="account-email" title={user.email}>{user.email}</span><button className="secondary-button signout-button" onClick={onSignOut}>Sair</button></div></header>
      <div className="page-content">
        {page==='dashboard'&&<Dashboard data={data} go={setPage}/>}
        {config[page]&&<RecordList key={page} config={config[page]} rows={visible} query={query} setQuery={setQuery} onNew={()=>openNew()} onView={setViewing} onEdit={row=>openEdit(page,row)} onDelete={row=>deleteRecord(page,row)} onConvert={page==='opportunities'?convertOpportunity:page==='ideas'?convertIdea:null} onDuplicate={page==='ideas'?duplicateIdea:null} />}
        {page==='lab'&&<Lab promptIdea={promptIdea} setPromptIdea={setPromptIdea} makePrompt={makePrompt} prompt={prompt} aiReply={aiReply} setAiReply={setAiReply} saveReply={saveReplyAsIdea}/>}
        {page==='evaluation'&&<Evaluation ideas={data.ideas} evaluations={data.evaluations} selected={evalIdea} setSelected={setEvalIdea} onSave={saveEvaluation}/>}
        {page==='settings'&&<SettingsPage storage={storage} data={data} onExport={exportJSON} onImport={importJSON} onCSV={exportCSV} onMigrate={migrateLegacy} onClear={async()=>{if(window.confirm('Excluir todos os registros do NEXUS no espaço compartilhado do Supabase?')){if(window.confirm('Confirmação final: essa ação remove os dados para todos os membros e não pode ser desfeita.')){try{await clearAll();await refresh();toast('Dados removidos.')}catch(e){toast(e.message||'Não foi possível limpar os dados.')}}}}}/>}
      </div>
      <footer>Uma ferramenta complementar para organizar oportunidades e iniciativas institucionais.</footer>
    </main>
    {viewing&&config[page]&&<RecordDetails config={config[page]} record={viewing} onClose={()=>setViewing(null)} onEdit={()=>openEdit(page,viewing)} />}
    {modal&&config[page]&&<RecordModal config={config[page]} record={editing} onClose={()=>{setModal(false);setEditing(null)}} onSave={(row,files,removed)=>saveRecord(page,row,files,removed)}/>}
    {notice&&<div className="toast"><Check size={16}/>{notice}</div>}
  </div>
}


function Evolution({data}) {
 const now=new Date();const months=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);return {key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}})
 const allRows=[...data.opportunities,...data.ideas,...data.projects];const counts=months.map(m=>allRows.filter(x=>(x.createdAt||'').slice(0,7)===m.key).length);const max=Math.max(1,...counts)
 return <section className="panel evolution-panel"><div className="panel-head"><div><h2>Evolução das iniciativas</h2><p>Novos registros nos últimos seis meses</p></div><Activity size={18}/></div>{allRows.length?<div className="evolution-chart">{months.map((m,i)=><div className="evolution-col" key={m.key}><b>{counts[i]}</b><span><i style={{height:Math.max(4,counts[i]/max*100)+'%'}}/></span><small>{m.label}</small></div>)}</div>:<Empty icon={Activity} title="Sem histórico para mostrar" text="O gráfico será preenchido conforme oportunidades, ideias e projetos forem registrados."/>}</section>
}

function Dashboard({data,go}) {
  const counts=[['Oportunidades',data.opportunities.length,'opportunities'],['Ideias registradas',data.ideas.length,'ideas'],['Em análise',data.ideas.filter(x=>x.status==='Em análise').length,'ideas'],['Ideias aprovadas',data.ideas.filter(x=>x.status==='Aprovada').length,'ideas'],['Projetos em desenvolvimento',data.projects.filter(x=>['Em desenvolvimento','Em execução'].includes(x.status)).length,'projects'],['Projetos concluídos',data.projects.filter(x=>x.status==='Concluído').length,'projects']]
  const recent=[...data.opportunities.map(x=>({...x,type:'Oportunidade',route:'opportunities'})),...data.ideas.map(x=>({...x,type:'Ideia',route:'ideas'})),...data.projects.map(x=>({...x,type:'Projeto',route:'projects'}))].sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'')).slice(0,5)
  const cats=Object.entries(data.ideas.reduce((acc,x)=>(acc[x.category||'Sem categoria']=(acc[x.category||'Sem categoria']||0)+1,acc),{})).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const max=Math.max(1,...cats.map(x=>x[1]))
  return <><div className="welcome"><div><div className="eyebrow">CENTRAL DE INTELIGÊNCIA E INOVAÇÃO</div><h1>Visão geral</h1><p>Acompanhe oportunidades e iniciativas em um só lugar.</p></div><button className="primary-button" onClick={()=>go('opportunities')}><Plus size={17}/> Nova oportunidade</button></div>
  <section className="stat-grid">{counts.map(([label,value,route],i)=><button className="stat-card" key={label} onClick={()=>go(route)}><div className="stat-heading"><span>{label}</span><span className={`stat-icon tone-${i%4}`}>{i===0?<Lightbulb size={17}/>:i>=4?<FolderKanban size={17}/>:<Sparkles size={17}/>}</span></div><strong>{value}</strong><small>Ver registros <ArrowRight size={13}/></small></button>)}</section>
  <div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-head"><div><h2>Atividades recentes</h2><p>Últimos registros atualizados</p></div><Activity size={18}/></div>{recent.length?<div className="recent-list">{recent.map(row=><button className="recent-row" key={`${row.type}-${row.id}`} onClick={()=>go(row.route)}><div className="record-icon"><Lightbulb size={16}/></div><div className="recent-info"><strong>{row.title}</strong><span>{row.type} · {row.status||'Sem status'}</span></div><time>{dateText((row.updatedAt||row.createdAt||'').slice(0,10))}</time></button>)}</div>:<Empty icon={Activity} title="Sua atividade começa aqui" text="Quando você registrar uma oportunidade, ideia ou projeto, eles aparecerão nesta lista." action="Registrar oportunidade" onAction={()=>go('opportunities')}/>}</section>
  <section className="panel"><div className="panel-head"><div><h2>Ideias por categoria</h2><p>Distribuição das ideias cadastradas</p></div><Sparkles size={18}/></div>{cats.length?<div className="bars">{cats.map(([name,value])=><div className="bar-row" key={name}><div className="bar-label"><span>{name}</span><b>{value}</b></div><div className="bar-track"><i style={{width:`${value/max*100}%`}}/></div></div>)}</div>:<Empty icon={Sparkles} title="Sem categorias ainda" text="As categorias serão exibidas quando você cadastrar ideias."/>}</section></div>
  <Evolution data={data}/><div className="dashboard-grid lower-grid"><section className="panel"><div className="panel-head"><div><h2>Projetos prioritários</h2><p>Iniciativas em andamento</p></div><BriefcaseBusiness size={18}/></div>{data.projects.filter(x=>['Em desenvolvimento','Em execução','Planejamento'].includes(x.status)).length?<div className="priority-list">{data.projects.filter(x=>['Em desenvolvimento','Em execução','Planejamento'].includes(x.status)).slice(0,4).map(p=><button onClick={()=>go('projects')} key={p.id}><span><b>{p.title}</b><small>{p.status}</small></span><ArrowRight size={16}/></button>)}</div>:<Empty icon={FolderKanban} title="Nenhum projeto em andamento" text="Ideias aprovadas podem ser estruturadas como projetos." action="Ver ideias" onAction={()=>go('ideas')}/>}</section>
  <section className="panel"><div className="panel-head"><div><h2>Por onde começar</h2><p>Um fluxo simples para organizar iniciativas</p></div><CircleHelp size={18}/></div><div className="start-steps">{[['01','Registre um sinal','Guarde uma oportunidade e sua fonte.','opportunities'],['02','Desenvolva a ideia','Organize o problema e gere um prompt contextualizado.','lab'],['03','Planeje a execução','Avalie a viabilidade e estruture um projeto.','evaluation']].map(s=><button key={s[0]} onClick={()=>go(s[3])}><b>{s[0]}</b><span><strong>{s[1]}</strong><small>{s[2]}</small></span><ArrowRight size={15}/></button>)}</div></section></div>
  <div className="notice-strip"><span className="notice-mark">i</span><span><b>Ferramenta complementar</b><small>O NEXUS organiza iniciativas e referências; ele não substitui os sistemas institucionais existentes.</small></span></div></>
}

function Empty({icon:Icon,title,text,action,onAction}){return <div className="empty"><div className="empty-icon"><Icon size={22}/></div><strong>{title}</strong><p>{text}</p>{action&&<button className="text-button" onClick={onAction}>{action} <ArrowRight size={14}/></button>}</div>}
function RecordList({config:cfg,rows,query,setQuery,onNew,onView,onEdit,onDelete,onConvert,onDuplicate}) {
 const Icon=cfg.icon
 return <><div className="page-heading"><div><div className="eyebrow">GESTÃO DE INICIATIVAS</div><h1>{cfg.title}</h1><p>{cfg.description}</p></div><button className="primary-button" onClick={onNew}><Plus size={17}/> Nova {cfg.singular}</button></div>
 <section className="panel table-panel"><div className="list-toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Buscar ${cfg.title.toLowerCase()}...`}/>{query&&<button onClick={()=>setQuery('')}><X size={15}/></button>}</div><div className="result-count">{rows.length} {rows.length===1?'registro':'registros'}</div></div>
 {rows.length?<div className="record-list">{rows.map(row=><article className="record-row" key={row.id}><div className="record-icon"><Icon size={18}/></div><div className="record-main"><div className="record-title-line"><h3><button type="button" className="record-title-button" onClick={()=>onView(row)}>{row.title||'Sem título'}</button></h3><Status value={row.status}/></div><p>{row.description||row.problem||row.objective||row.question||(row.stages?.length?`${row.stages.length} etapa(s) no projeto`:'Sem descrição registrada.')}</p><div className="record-meta"><span>{row.category||cfg.title}</span><span>·</span><span>Atualizado {dateText((row.updatedAt||row.createdAt||'').slice(0,10))}</span>{row.attachments?.length>0&&<><span>·</span><span className="attachment-count"><Paperclip size={12}/>{row.attachments.length}</span></>}</div></div><div className="record-actions">{onConvert&&<button className="action-convert" onClick={()=>onConvert(row)}>{cfg.singular==='oportunidade'?'Transformar em ideia':'Criar projeto'} <ArrowRight size={14}/></button>}{onDuplicate&&<button className="icon-button" title="Duplicar ideia" onClick={()=>onDuplicate(row)}><Copy size={15}/></button>}<button className="icon-button" title="Abrir registro" onClick={()=>onView(row)}><Eye size={16}/></button><button className="icon-button" title="Editar" onClick={()=>onEdit(row)}><Settings size={16}/></button><button className="icon-button danger" title="Excluir" onClick={()=>onDelete(row)}><Trash2 size={16}/></button></div></article>)}</div>:query?<Empty icon={Search} title="Nenhum resultado" text="Tente outro termo de busca."/>:<Empty icon={Icon} title={`Ainda não há ${cfg.title.toLowerCase()}`} text={`Cadastre a primeira ${cfg.singular} para começar a organizar as informações.`} action={`Cadastrar ${cfg.singular}`} onAction={onNew}/>}
 </section></>
}
function Status({value}){if(!value)return null;const cls=value==='Aprovada'||value==='Concluído'?'green':value==='Em análise'||value==='Planejamento'?'amber':value==='Arquivada'||value==='Cancelado'||value==='Rejeitada'?'gray':'blue';return <span className={`status ${cls}`}><i/>{value}</span>}
function RecordModal({config:cfg,record,onClose,onSave}) {
 const [form,setForm]=useState(record);const [saving,setSaving]=useState(false);const [pendingFiles,setPendingFiles]=useState([]);const [error,setError]=useState('')
 const originalAttachments=record.attachments||[]
 const removedAttachments=originalAttachments.filter(file=>!(form.attachments||[]).some(item=>item.path===file.path))
 async function submit(e){e.preventDefault();setSaving(true);setError('');try{await onSave(form,pendingFiles,removedAttachments)}catch(err){setError(err.message||'Não foi possível salvar o registro.')}finally{setSaving(false)}}
 function stageFiles(list){const files=Array.from(list||[]);const oversized=files.find(file=>file.size>MAX_ATTACHMENT_SIZE);if(oversized){setError(`“${oversized.name}” excede o limite de 50 MB.`);return}setPendingFiles(current=>[...current,...files]);setError('')}
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="record-modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">{record.id?'EDITAR REGISTRO':'NOVO REGISTRO'}</div><h2>{record.id?'Editar':'Cadastrar'} {cfg.singular}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div><div className="modal-fields">{cfg.fields.map(([key,label,type,required,options])=><label className={type==='textarea'?'wide':''} key={key}>{label}{required&&<em> *</em>}{type==='textarea'?<textarea rows="3" required={required} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}/>:type==='select'?<select required={required} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}><option value="">Selecionar...</option>{options.map(o=><option key={o}>{o}</option>)}</select>:<input type={type} required={required} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>)}
 <section className="attachment-editor wide"><div className="attachment-editor-head"><div><b>Anexos</b><small>Até 50 MB por arquivo. Imagens e PDFs aparecem no registro; outros arquivos podem ser baixados.</small></div><label className="secondary-button file-button"><Upload size={15}/> Anexar arquivos<input type="file" multiple onChange={e=>{stageFiles(e.target.files);e.target.value=''}}/></label></div>
 {(form.attachments||[]).length>0&&<div className="attachment-pending-list">{form.attachments.map(file=><div className="attachment-pending" key={file.path}><File size={15}/><span>{file.name}</span><button type="button" className="icon-button danger" aria-label={`Remover ${file.name}`} onClick={()=>setForm({...form,attachments:form.attachments.filter(item=>item.path!==file.path)})}><X size={14}/></button></div>)}</div>}
 {pendingFiles.map((file,index)=><div className="attachment-pending" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}><File size={15}/><span>{file.name} · {formatBytes(file.size)} · aguardando salvar</span><button type="button" className="icon-button danger" aria-label={`Remover ${file.name}`} onClick={()=>setPendingFiles(pendingFiles.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}
 {error&&<p className="attachment-error" role="alert">{error}</p>}</section>
 {cfg.title==='Projetos'&&<StageEditor stages={form.stages||[]} onChange={stages=>setForm({...form,stages})}/>}</div><div className="modal-foot"><span>Campos com * são obrigatórios</span><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}><Check size={16}/>{saving?'Salvando...':'Salvar registro'}</button></div></form></div>
}

function RecordDetails({config:cfg,record,onClose,onEdit}) {
 const fields=cfg.fields.filter(([key])=>!['title','status'].includes(key)).map(([key,label])=>({key,label,value:record[key]})).filter(field=>field.value)
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="record-modal detail-modal"><div className="modal-head"><div><div className="eyebrow">{cfg.singular.toUpperCase()}</div><h2>{record.title||'Sem título'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div><div className="detail-content">{record.status&&<div className="detail-status"><Status value={record.status}/></div>}{fields.length>0&&<div className="detail-fields">{fields.map(field=><div className="detail-field" key={field.key}><b>{field.label}</b><p>{field.value}</p></div>)}</div>}{record.stages?.length>0&&<section className="detail-section"><h3>Etapas do projeto</h3><div className="detail-stages">{record.stages.map((stage,index)=><div className="detail-stage" key={stage.id||index}><b>{stage.name||`Etapa ${index+1}`}</b><span>{stage.status}{stage.date?` · ${dateText(stage.date)}`:''}</span>{stage.description&&<p>{stage.description}</p>}</div>)}</div></section>}<AttachmentGallery attachments={record.attachments||[]}/></div><div className="modal-foot"><span>Atualizado {dateText((record.updatedAt||record.createdAt||'').slice(0,10))}</span><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button" onClick={onEdit}><Settings size={15}/> Editar</button></div></section></div>
}

function AttachmentGallery({attachments}) {
 return <section className="detail-section attachment-gallery"><div className="attachment-gallery-head"><div><h3>Anexos</h3><p>{attachments.length?`${attachments.length} arquivo(s) neste registro`:'Nenhum anexo neste registro'}</p></div></div>{attachments.length>0&&<div className="attachment-grid">{attachments.map(file=><AttachmentPreview key={file.path} file={file}/>)}</div>}</section>
}

function AttachmentPreview({file}) {
 const [url,setUrl]=useState('');const [error,setError]=useState('')
 const isImage=file.type?.startsWith('image/')||/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name)
 const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name)
 useEffect(()=>{let active=true;attachmentUrl(file.path).then(value=>{if(active)setUrl(value)}).catch(err=>{if(active)setError(err.message||'Não foi possível abrir o anexo.')});return()=>{active=false}},[file.path])
 async function downloadFile(){try{const signed=await attachmentUrl(file.path,true);const link=document.createElement('a');link.href=signed;link.rel='noreferrer';link.click()}catch(err){setError(err.message||'Não foi possível baixar o anexo.')}}
 return <article className="attachment-card"><div className="attachment-card-head"><div className="attachment-file-icon">{isImage?<Eye size={16}/>:isPdf?<FileSearch size={16}/>:<File size={16}/>}</div><div className="attachment-file-name"><b title={file.name}>{file.name}</b><small>{formatBytes(file.size)}</small></div><button type="button" className="icon-button" title="Baixar arquivo" onClick={downloadFile}><Download size={16}/></button></div>{error?<p className="attachment-error">{error}</p>:isImage?<div className="attachment-image-wrap">{url?<img src={url} alt={file.name}/>:<span>Carregando imagem…</span>}</div>:isPdf?<div className="attachment-pdf-wrap">{url?<iframe src={url} title={`Prévia: ${file.name}`}/>:<span>Carregando PDF…</span>}</div>:<p className="attachment-download-note">Este formato precisa ser baixado para abrir.</p>}</article>
}

function formatBytes(size=0){if(size<1024)return `${size} B`;if(size<1024*1024)return `${(size/1024).toFixed(1)} KB`;return `${(size/(1024*1024)).toFixed(1)} MB`}

const conclusionFields=[['favorable','Pontos favoráveis'],['difficulties','Dificuldades'],['resources','Recursos necessários'],['risks','Riscos'],['unknowns','Informações desconhecidas'],['alternatives','Alternativas mais simples'],['nextAction','Próxima ação recomendada']]
const criteria=[['institutional','Relevância institucional'],['workers','Benefício para trabalhadores'],['businesses','Benefício para empresas do setor'],['cost','Adequação do custo estimado'],['complexity','Simplicidade técnica e operacional'],['time','Adequação do prazo'],['team','Disponibilidade de equipe'],['partners','Disponibilidade de parceiros'],['external','Baixa dependência externa'],['information','Disponibilidade de informações'],['legal','Risco jurídico controlável'],['operation','Risco operacional controlável'],['outcome','Potencial de resultado'],['individual','Execução individual com apoio de IA'],['mvp','Possibilidade de começar com MVP']]

function StageEditor({stages,onChange}) {
 const update=(index,field,value)=>onChange(stages.map((stage,i)=>i===index?{...stage,[field]:value}:stage))
 return <div className="wide stage-editor"><div className="stage-head"><b>Etapas de execução</b><button type="button" className="text-button" onClick={()=>onChange([...stages,{id:uid(),name:'',description:'',status:'Planejamento',date:'',notes:''}])}><Plus size={14}/> Adicionar etapa</button></div>{stages.map((stage,index)=><div className="stage-row" key={stage.id||index}><div className="stage-row-title"><b>Etapa {index+1}</b><button type="button" className="icon-button danger" onClick={()=>onChange(stages.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div><input placeholder="Nome da etapa" value={stage.name||''} onChange={e=>update(index,'name',e.target.value)}/><textarea rows="2" placeholder="Descrição e observações" value={stage.description||''} onChange={e=>update(index,'description',e.target.value)}/><div className="stage-row-bottom"><select value={stage.status||'Planejamento'} onChange={e=>update(index,'status',e.target.value)}>{['Planejamento','Em andamento','Concluída','Pausada'].map(o=><option key={o}>{o}</option>)}</select><input type="date" aria-label="Data prevista" value={stage.date||''} onChange={e=>update(index,'date',e.target.value)}/></div></div>)}</div>
}

function Evaluation({ideas,evaluations,selected,setSelected,onSave}) {
 const latest=[...evaluations].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
 return <><div className="page-heading"><div><div className="eyebrow">INTELIGÊNCIA E PLANEJAMENTO</div><h1>Análise de viabilidade</h1><p>Registre critérios, justificativas e uma próxima ação para cada ideia.</p></div></div>
 <div className="eval-layout"><section className="panel eval-form"><div className="panel-head"><div><h2>Avaliar uma ideia</h2><p>Notas de 1 (baixo) a 5 (alto). A pontuação é apenas um apoio à decisão.</p></div><ClipboardList size={19}/></div>{ideas.length?<><label className="field-label">Ideia<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecione uma ideia...</option>{ideas.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label><div className="criteria-list">{criteria.map(([key,label])=><div className="criteria-row" key={key}><div><b>{label}</b><input id={`why-${key}`} placeholder="Justificativa (opcional)"/></div><select id={`score-${key}`} defaultValue="3" aria-label={`Nota: ${label}`}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></div>)}</div><div className="conclusion-fields">{conclusionFields.map(([key,label])=><label className="field-label" key={key}>{label}<textarea id={'conclusion-'+key} rows="2" placeholder={'Registre '+label.toLowerCase()+' com base nas informações disponíveis.'}/></label>)}</div><button className="primary-button" onClick={onSave}><Check size={16}/> Salvar avaliação</button></>:<Empty icon={Sparkles} title="Cadastre uma ideia primeiro" text="A avaliação fica vinculada a uma ideia da biblioteca."/>}</section>
 <section className="panel eval-history"><div className="panel-head"><div><h2>Avaliações registradas</h2><p>{latest.length} avaliação(ões)</p></div><Activity size={19}/></div>{latest.length?latest.map(row=><div className="evaluation-card" key={row.id}><div className="evaluation-score">{row.score}<small>/100</small></div><div><b>{row.title}</b><small>{dateText(row.createdAt.slice(0,10))} · média indicativa</small><details className="evaluation-details"><summary>Ver análise</summary><div className="evaluation-detail-grid">{Object.entries(row.conclusions||{}).filter(([,value])=>value).map(([key,value])=><div key={key}><b>{conclusionFields.find(([k])=>k===key)?.[1]||key}</b><p>{value}</p></div>)}{criteria.map(([key,label])=><div key={key}><b>{label}: {row.scores?.[key]??'—'}/5</b>{row.justifications?.[key]&&<p>{row.justifications[key]}</p>}</div>)}</div></details></div></div>):<Empty icon={ClipboardList} title="Nenhuma avaliação ainda" text="As análises salvas aparecerão aqui."/>}<div className="caution"><CircleHelp size={16}/> A pontuação não é uma decisão definitiva. Custos, recursos e riscos dependem das informações registradas.</div></section></div></>
}
function Lab({promptIdea,setPromptIdea,makePrompt,prompt,aiReply,setAiReply,saveReply}) {
 return <><div className="page-heading"><div><div className="eyebrow">ESTRUTURAÇÃO ASSISTIDA</div><h1>Laboratório de ideias</h1><p>Organize um desafio e leve o contexto certo para uma ferramenta de IA externa.</p></div></div><div className="lab-layout"><section className="panel lab-card"><div className="step-title"><span>01</span><div><h2>Conte o que você está pensando</h2><p>Use informações reais que já tenha. Você pode deixar campos em branco.</p></div></div><label className="field-label">Problema ou oportunidade<textarea rows="4" value={promptIdea.problem} onChange={e=>setPromptIdea({...promptIdea,problem:e.target.value})} placeholder="O que chamou sua atenção? Que necessidade pode ser atendida?"/></label><label className="field-label">Contexto conhecido<textarea rows="3" value={promptIdea.context} onChange={e=>setPromptIdea({...promptIdea,context:e.target.value})} placeholder="Descreva fatos, fontes ou iniciativas relacionadas."/></label><div className="two-fields"><label className="field-label">Público potencial<input value={promptIdea.audience} onChange={e=>setPromptIdea({...promptIdea,audience:e.target.value})} placeholder="Quem seria beneficiado?"/></label><label className="field-label">Limitações conhecidas<input value={promptIdea.constraints} onChange={e=>setPromptIdea({...promptIdea,constraints:e.target.value})} placeholder="Prazo, orçamento, equipe..."/></label></div><button className="primary-button" onClick={makePrompt}><Sparkles size={17}/> Gerar prompt para IA</button><p className="helper-note">O NEXUS não envia dados para serviços externos. O prompt é copiado para você colar onde preferir.</p></section>
 <aside className="panel lab-side"><div className="step-title"><span>02</span><div><h2>Revise e use o prompt</h2><p>Inclui referências e iniciativas cadastradas na base do NEXUS.</p></div></div>{prompt?<><textarea className="prompt-output" readOnly value={prompt}/><button className="secondary-button full-button" onClick={()=>navigator.clipboard.writeText(prompt)}>Copiar prompt</button><div className="step-title step-next"><span>03</span><div><h2>Traga o resultado</h2><p>Cole a resposta da IA para guardar como ideia.</p></div></div><textarea rows="6" value={aiReply} onChange={e=>setAiReply(e.target.value)} placeholder="Cole aqui a resposta que você recebeu..."/><button className="primary-button full-button" disabled={!aiReply.trim()} onClick={saveReply}><Plus size={16}/> Salvar na biblioteca de ideias</button></>:<div className="prompt-empty"><div className="empty-icon"><Sparkles size={22}/></div><b>Seu prompt contextualizado aparecerá aqui</b><p>Preencha o desafio e gere um prompt para iniciar a análise em uma ferramenta externa.</p></div>}</aside></div></>
}
function SettingsPage({storage,data,onExport,onImport,onCSV,onMigrate,onClear}) {
 return <><div className="page-heading"><div><div className="eyebrow">PREFERÊNCIAS DO SISTEMA</div><h1>Configurações</h1><p>Gerencie o espaço compartilhado, os backups e as exportações.</p></div></div><div className="settings-grid">
 <section className="panel settings-card"><div className="panel-head"><div><h2>Backup e restauração</h2><p>Uma cópia JSON inclui todos os registros do espaço NEXUS.</p></div><Archive size={19}/></div><div className="backup-callout"><span>!</span><p>Os registros ficam no Supabase e são compartilhados entre membros autorizados. Exporte backups JSON regularmente e guarde-os em local seguro.</p></div><div className="settings-actions"><button className="primary-button" onClick={onExport}><ArrowDownToLine size={16}/> Exportar backup JSON</button><label className="secondary-button file-button"><ArrowUpFromLine size={16}/> Importar backup JSON<input type="file" accept="application/json,.json" onChange={e=>{if(e.target.files?.[0])onImport(e.target.files[0]);e.target.value=''}}/></label></div><small className="muted">A importação valida o formato e pede confirmação antes de mesclar ou substituir o espaço compartilhado.</small></section>
 <section className="panel settings-card"><div className="panel-head"><div><h2>Importar dados locais anteriores</h2><p>Recupere registros da versão anterior armazenados neste navegador.</p></div><Archive size={19}/></div><p className="muted">A importação mescla os registros locais ao espaço compartilhado do Supabase. Os dados antigos permanecem neste navegador.</p><button className="secondary-button" onClick={onMigrate}><ArrowUpFromLine size={16}/> Importar dados deste navegador</button></section>
 <section className="panel settings-card"><div className="panel-head"><div><h2>Exportar tabelas</h2><p>Baixe um módulo em formato CSV.</p></div><ArrowDownToLine size={19}/></div><div className="csv-options">{stores.map(store=><button key={store} onClick={()=>onCSV(store)}><span>{({evaluations:'Análises de viabilidade'})[store]||config[store]?.title||store}<small>{data[store]?.length||0} registros</small></span><ArrowDownToLine size={16}/></button>)}</div></section>
 <section className="panel settings-card"><div className="panel-head"><div><h2>Armazenamento</h2><p>Persistência remota no espaço autorizado do Supabase.</p></div><Archive size={19}/></div><div className="storage-stats"><div><span>Registros no espaço compartilhado</span><b>{storage?.recordCount??'—'}</b></div><div><span>Banco de dados</span><b>Supabase · PostgreSQL</b></div><div><span>Conexão</span><b>{storage?.connected?'Ativa':'Verificando…'}</b></div></div><p className="muted">O provedor controla a capacidade e a retenção do banco. Mantenha um backup JSON atualizado.</p></section>
 <section className="panel settings-card danger-card"><div className="panel-head"><div><h2>Limpar dados</h2><p>Remove todos os registros compartilhados do NEXUS.</p></div><Trash2 size={19}/></div><button className="danger-button" onClick={onClear}><Trash2 size={16}/> Limpar todos os dados</button></section>
 </div></>
}

export default App


