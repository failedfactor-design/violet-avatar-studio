import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AvatarStage from './AvatarStage.jsx';
import { getRobloxAvatar, searchCatalog } from './roblox.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const iconPaths = {
  spark: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  shirt: 'M16 4a4 4 0 0 1-8 0L3 7l2 5 3-1v10h8V11l3 1 2-5-5-3Z',
  search: 'm21 21-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM17 21v-8H7v8M7 3v5h8',
  box: 'M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7ZM3.3 7 12 12l8.7-5M12 22V12',
  arrow: 'M7 17 17 7M7 7h10v10',
  close: 'M18 6 6 18M6 6l12 12',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sparkle: 'm12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z'
};
function Icon({ name, size = 18, strokeWidth = 1.7 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name] || iconPaths.spark} /></svg>; }

const initialItems = [
  { id: 'hat', name: 'Headwear', thai: 'ศีรษะ', detail: 'หมวก · ผม · หน้ากาก', glyph: '◈' },
  { id: 'tops', name: 'Tops', thai: 'เสื้อ', detail: 'Classic & layered', glyph: '▧' },
  { id: 'bottoms', name: 'Bottoms', thai: 'กางเกง', detail: 'Pants & skirts', glyph: '▥' },
  { id: 'accessories', name: 'Accessories', thai: 'เครื่องประดับ', detail: 'Back · shoulder · waist', glyph: '✧' },
];

function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [rig, setRig] = useState('R15');
  const [sourceMode, setSourceMode] = useState('mannequin');
  const [modelSource, setModelSource] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [draftItems, setDraftItems] = useState([]);
  const [savedLooks, setSavedLooks] = useState([]);
  const [lookName, setLookName] = useState('My Violet Fit');
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarAssetsTab, setAvatarAssetsTab] = useState('all');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, sessionValue) => setSession(sessionValue));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshLooks = useCallback(async () => {
    if (!supabase || !session?.user) { setSavedLooks([]); return; }
    const { data, error: queryError } = await supabase.from('saved_outfits').select('*').order('updated_at', { ascending: false });
    if (!queryError) setSavedLooks(data || []);
  }, [session]);
  useEffect(() => { refreshLooks(); }, [refreshLooks]);

  const handleLookup = async (event) => {
    event?.preventDefault();
    const clean = username.trim().replace(/^@/, '');
    if (!clean) { setError('กรอก Roblox username ก่อนค้นหา'); return; }
    setIsLooking(true); setError(''); setStatus('');
    try {
      const result = await getRobloxAvatar(clean);
      setAvatar(result);
      setRig(result.avatarType === 'R6' ? 'R6' : 'R15');
      setSourceMode(result.modelUrl ? 'roblox' : 'roblox-image');
      setModelSource(result.modelUrl ? { modelUrl: result.modelUrl } : null);
      setDraftItems([]);
      setStatus(result.modelUrl ? 'โหลดอวาตาร์ Roblox สำเร็จ' : 'พบผู้ใช้แล้ว — กำลังใช้ภาพอวาตาร์ เพราะยังไม่ได้ตั้งค่า API key สำหรับโมเดล 3D');
    } catch (e) {
      setError(e.message || 'ค้นหาอวาตาร์ไม่สำเร็จ');
    } finally { setIsLooking(false); }
  };

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['glb', 'gltf', 'obj'].includes(ext)) {
      setError('ไฟล์ที่รองรับตอนนี้คือ .glb, .gltf และ .obj (ไฟล์ .rbxm/.rbxmx ยังเปิดตรง ๆ ในเว็บไม่ได้)');
      return;
    }
    if (file.size > 25 * 1024 * 1024) { setError('ไฟล์ใหญ่เกิน 25 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้'); return; }
    const url = URL.createObjectURL(file);
    if (modelSource?.url) URL.revokeObjectURL(modelSource.url);
    setModelSource({ url, name: file.name });
    setFileName(file.name);
    setAvatar(null);
    setSourceMode('file');
    setError(''); setStatus(`เพิ่ม ${file.name} เข้าพรีวิวแล้ว (ยังเก็บอยู่ในอุปกรณ์นี้)`);
  };

  const handleCatalogSearch = async (event) => {
    event?.preventDefault();
    setCatalogBusy(true); setCatalogError('');
    try {
      const result = await searchCatalog(catalogQuery.trim());
      setCatalogItems(result.items || []);
    } catch (e) { setCatalogError(e.message || 'ค้นหา Catalog ไม่สำเร็จ'); }
    finally { setCatalogBusy(false); }
  };

  const addCatalogItem = (item) => {
    const id = String(item.id ?? item.assetId ?? item.itemId ?? '');
    if (!id) return;
    setDraftItems(prev => prev.some(x => String(x.id) === id) ? prev : [...prev, {
      id, name: item.name || 'Roblox item', price: item.price ?? item.lowestPrice ?? null,
      itemType: item.itemType || item.assetType || 'Catalog item', thumbnail: item.thumbnail || item.imageUrl || '',
      creator: item.creatorName || item.creator?.name || 'Roblox Creator'
    }]);
    setStatus(`เพิ่ม ${item.name || 'ไอเทม'} เข้า Outfit Draft แล้ว`);
  };
  const removeDraft = (id) => setDraftItems(prev => prev.filter(x => String(x.id) !== String(id)));

  const saveLook = async () => {
    if (!supabase) { setError('ยังไม่ได้ตั้งค่า Supabase (.env.local)'); return; }
    if (!session?.user) { setAuthOpen(true); setAuthMessage('เข้าสู่ระบบด้วยอีเมลก่อน เพื่อบันทึกชุดแต่งตัว'); return; }
    setSaving(true); setError('');
    const payload = {
      user_id: session.user.id,
      name: lookName.trim() || 'My Look',
      rig,
      roblox_user_id: avatar?.userId ? Number(avatar.userId) : null,
      config: { sourceMode, username: avatar?.username || null, items: draftItems, fileName: sourceMode === 'file' ? fileName : null }
    };
    const { error: insertError } = await supabase.from('saved_outfits').insert(payload);
    if (insertError) setError(`บันทึกไม่สำเร็จ: ${insertError.message}`);
    else { setStatus('บันทึกชุดลง Supabase แล้ว'); await refreshLooks(); setActiveTab('looks'); }
    setSaving(false);
  };

  const deleteLook = async (id) => {
    if (!supabase || !session?.user) return;
    const { error: deleteError } = await supabase.from('saved_outfits').delete().eq('id', id);
    if (deleteError) setError(deleteError.message); else refreshLooks();
  };

  const loadLook = async (look) => {
    setLookName(look.name || 'My Look');
    setRig(look.rig === 'R6' ? 'R6' : 'R15');
    setDraftItems(Array.isArray(look.config?.items) ? look.config.items : []);
    setActiveTab('studio');
    setError('');
    if (look.config?.username) {
      setUsername(look.config.username);
      setIsLooking(true);
      try {
        const result = await getRobloxAvatar(look.config.username);
        setAvatar(result);
        setRig(result.avatarType || look.rig || 'R15');
        setSourceMode(result.modelUrl ? 'roblox' : 'roblox-image');
        setModelSource(result.modelUrl ? { modelUrl: result.modelUrl } : null);
        setStatus(`เปิดชุด ${look.name} แล้ว`);
      } catch (e) {
        setError(`เปิดชุดได้ แต่โหลดอวาตาร์ต้นฉบับไม่สำเร็จ: ${e.message}`);
      } finally { setIsLooking(false); }
    } else {
      setAvatar(null);
      setModelSource(null);
      setSourceMode('mannequin');
      setStatus(look.config?.fileName ? `โหลดข้อมูลชุด ${look.name} แล้ว — ไฟล์โมเดลอยู่ในอุปกรณ์เดิม กรุณา Import ไฟล์อีกครั้ง` : `เปิดชุด ${look.name} แล้ว`);
    }
  };

  const sendLoginLink = async (event) => {
    event.preventDefault(); setAuthMessage('');
    if (!supabase) { setAuthMessage('ตั้งค่า Supabase ใน .env.local ก่อน'); return; }
    if (!authEmail.includes('@')) { setAuthMessage('กรอกอีเมลที่ถูกต้อง'); return; }
    const { error: loginError } = await supabase.auth.signInWithOtp({ email: authEmail.trim(), options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } });
    setAuthMessage(loginError ? loginError.message : 'ส่งลิงก์เข้าสู่ระบบไปยังอีเมลแล้ว โปรดเปิดลิงก์จากอุปกรณ์นี้');
  };
  const signOut = async () => { await supabase?.auth.signOut(); setSession(null); setSavedLooks([]); };

  const currentRigLabel = avatar?.avatarType || rig;
  const currentName = avatar?.displayName || avatar?.username || (sourceMode === 'file' ? fileName : 'Violet Prototype');
  const itemCount = draftItems.length;
  const itemsByCategory = useMemo(() => {
    if (avatar?.assets?.length) return avatar.assets;
    return [];
  }, [avatar]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="brand-mark"><Icon name="spark" size={22} /></div><div><div className="brand-name">VIOLET<span>//</span></div><div className="brand-sub">AVATAR STUDIO</div></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav">
        <button className={activeTab === 'studio' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('studio')}><Icon name="spark" /> <span>Avatar Studio</span><span className="nav-key">01</span></button>
        <button className={activeTab === 'catalog' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('catalog')}><Icon name="box"/><span>Roblox Catalog</span><span className="nav-key">02</span></button>
        <button className={activeTab === 'looks' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('looks')}><Icon name="heart"/><span>Saved Looks</span><span className="nav-key">{savedLooks.length}</span></button>
      </nav>
      <div className="sidebar-divider" />
      <div className="side-label">QUICK TOOLS</div>
      <label className="quick-tool" htmlFor="model-file"><div className="tool-icon"><Icon name="upload"/></div><div><b>Import 3D Model</b><small>GLB · GLTF · OBJ</small></div><span className="tool-plus">+</span></label>
      <input id="model-file" className="visually-hidden" type="file" accept=".glb,.gltf,.obj" onClick={e => { e.currentTarget.value = ""; }} onChange={e => handleFile(e.target.files?.[0])}/>
      <div className="sidebar-bottom">
        <div className="limit-card"><div className="limit-orb"><Icon name="sparkle" size={19}/></div><b>Make it yours.</b><p>Import a look. Explore a style. Build your own.</p><div className="limit-line"><span /></div><small>R6 / R15 ONLY</small></div>
        <button className="account-button" onClick={() => session ? signOut() : (setAuthOpen(true), setAuthMessage(''))}>
          <div className="account-avatar">{session?.user?.email?.[0]?.toUpperCase() || 'V'}</div><div className="account-info"><b>{session?.user?.email || 'Guest workspace'}</b><small>{session ? 'Signed in · Supabase' : 'Local preview mode'}</small></div><Icon name={session ? 'logout' : 'user'} size={16}/>
        </button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><span>WORKSPACE</span><b>/</b><strong>{activeTab === 'studio' ? 'AVATAR STUDIO' : activeTab === 'catalog' ? 'ROBLOX CATALOG' : 'SAVED LOOKS'}</strong></div>
        <div className="top-actions"><span className="service-status"><i /> SYSTEM READY</span><button className="top-avatar" onClick={() => session ? signOut() : setAuthOpen(true)}>{session?.user?.email?.[0]?.toUpperCase() || 'G'}</button></div>
      </header>

      {activeTab === 'studio' && <>
        <section className="page-heading"><div><div className="eyebrow"><span /> CHARACTER WORKBENCH <span className="eyebrow-line"/></div><h1>Make your <em>avatar.</em></h1><p>Build a look that feels like you. R6, R15, your way.</p></div><div className="heading-actions"><div className="version-chip"><span>●</span> STUDIO BUILD <b>0.1</b></div><button className="button-primary" onClick={saveLook} disabled={saving}><Icon name="save" size={16}/>{saving ? 'กำลังบันทึก…' : 'Save look'}</button></div></section>
        <section className="workspace-grid">
          <div className="control-panel panel">
            <div className="panel-heading"><div><span className="section-index">01</span><h2>Character source</h2></div><span className="tiny-pill">IMPORT</span></div>
            <form className="username-form" onSubmit={handleLookup}>
              <label htmlFor="roblox-username">ROBLOX USERNAME</label>
              <div className="username-input"><span>@</span><input id="roblox-username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoCapitalize="none" autoCorrect="off"/><button type="submit" disabled={isLooking} aria-label="Search username"><Icon name="search" size={17}/></button></div>
              <small className="helper-text">Load a public Roblox avatar by username.</small>
            </form>
            <div className="or-separator"><span/> OR IMPORT A MODEL <span/></div>
            <label className="dropzone" htmlFor="model-file"><div className="drop-icon"><Icon name="upload" size={20}/></div><b>{fileName || 'Drop a 3D model here'}</b><span>or tap to browse files</span><small>GLB / GLTF / OBJ · max 25 MB</small></label>
            <div className="panel-divider" />
            <div className="panel-heading compact"><div><span className="section-index">02</span><h2>Avatar rig</h2></div></div>
            <div className="rig-choice">
              <button className={rig === 'R6' ? 'rig-option selected' : 'rig-option'} onClick={() => { setRig('R6'); setSourceMode(sourceMode === 'file' ? 'file' : sourceMode === 'roblox' ? 'roblox' : 'mannequin'); }}><div className="rig-mini r6-mini"><i/><b/><span/><span/></div><div><b>R6</b><small>Classic · 6 parts</small></div><span className="rig-check">{rig === 'R6' ? '✓' : ''}</span></button>
              <button className={rig === 'R15' ? 'rig-option selected' : 'rig-option'} onClick={() => setRig('R15')}><div className="rig-mini r15-mini"><i/><b/><span/><span/></div><div><b>R15</b><small>Modern · 15 parts</small></div><span className="rig-check">{rig === 'R15' ? '✓' : ''}</span></button>
            </div>
            <p className="rig-note">Rig selection is a preview/editing preference. Changing R6 ↔ R15 does not convert another user's Roblox avatar automatically.</p>
            <div className="panel-divider" />
            <div className="panel-heading compact"><div><span className="section-index">03</span><h2>Outfit draft</h2></div><span className="count-pill">{itemCount} ITEMS</span></div>
            {draftItems.length ? <div className="draft-list">{draftItems.map(item => <div className="draft-item" key={item.id}><div className="draft-swatch">{item.thumbnail ? <img src={item.thumbnail} alt=""/> : '✧'}</div><div className="draft-meta"><b>{item.name}</b><small>Asset ID {item.id}</small></div><button onClick={() => removeDraft(item.id)} aria-label={`Remove ${item.name}`}><Icon name="close" size={15}/></button></div>)}</div> : <div className="empty-draft"><div className="empty-draft-icon">＋</div><span>Your outfit draft is empty.</span><button onClick={() => setActiveTab('catalog')}>Browse Catalog <Icon name="arrow" size={13}/></button></div>}
          </div>

          <div className="preview-column">
            <div className="preview-panel panel">
              <div className="preview-topline"><div className="preview-state"><span className="live-dot"/> LIVE PREVIEW <i/></div><div className="preview-meta">{currentRigLabel} <span/> 3D VIEWPORT</div></div>
              <div className="preview-canvas">
                {sourceMode === 'roblox-image' && avatar?.thumbnailUrl ? <div className="avatar-image-fallback"><img src={avatar.thumbnailUrl} alt={`${avatar.username} Roblox avatar`} /></div> : <AvatarStage source={modelSource} rig={rig} mode={sourceMode === 'roblox' ? 'roblox' : sourceMode === 'file' ? 'file' : 'mannequin'}/>}
                <div className="canvas-corner corner-tl"/><div className="canvas-corner corner-tr"/><div className="canvas-corner corner-bl"/><div className="canvas-corner corner-br"/>
                <div className="canvas-coordinate">XYZ <span>0.00 · 1.75 · 0.00</span></div>
                <div className="canvas-watermark">V<span>//</span></div>
              </div>
              <div className="preview-footer"><div className="active-character"><div className="character-swatch">{avatar?.thumbnailUrl ? <img src={avatar.thumbnailUrl} alt=""/> : <Icon name="user" size={20}/>}</div><div><b>{currentName}</b><small>{avatar?.username ? `@${avatar.username} · ID ${avatar.userId}` : sourceMode === 'file' ? 'IMPORTED LOCAL MODEL' : 'CUSTOM MANNEQUIN'}</small></div></div><div className="preview-tools"><button title="Reset preview" onClick={() => { setModelSource(null); setFileName(''); setAvatar(null); setSourceMode('mannequin'); setError(''); setStatus('พรีวิวกลับสู่ตัวละครตัวอย่างแล้ว'); }}><Icon name="sparkle" size={16}/></button><button title="Import model" onClick={() => document.getElementById('model-file')?.click()}><Icon name="upload" size={16}/></button></div></div>
            </div>
            <div className="feedback-row">{isLooking ? <div className="feedback pending"><span className="spinner small-spinner"/>กำลังค้นหา Roblox username…</div> : error ? <div className="feedback error"><span>!</span>{error}</div> : status ? <div className="feedback success"><span>✓</span>{status}</div> : <div className="feedback"><span className="feedback-glyph">✦</span> READY WHEN YOU ARE <span className="feedback-end">LOCAL PREVIEW</span></div>}</div>
            <div className="below-cards"><div className="mini-stat panel"><div className="mini-stat-icon"><Icon name="box" size={17}/></div><div><small>OUTFIT ITEMS</small><b>{String(itemCount).padStart(2, '0')} <span>items staged</span></b></div></div><div className="mini-stat panel"><div className="mini-stat-icon purple"><Icon name="user" size={17}/></div><div><small>ACTIVE RIG</small><b>{rig} <span>{rig === 'R6' ? 'Classic body' : 'Modern body'}</span></b></div></div></div>
          </div>

          <div className="inspector-panel panel">
            <div className="panel-heading"><div><span className="section-index">04</span><h2>Inspector</h2></div><span className="inspector-dots">•••</span></div>
            <div className="inspector-profile">{avatar?.thumbnailUrl ? <img src={avatar.thumbnailUrl} alt=""/> : <div className="profile-placeholder"><Icon name="user" size={28}/></div>}<div><b>{currentName}</b><small>{avatar?.username ? 'ROBLOX PROFILE' : sourceMode === 'file' ? 'CUSTOM ASSET' : 'UNNAMED CHARACTER'}</small></div></div>
            <div className="inspector-facts"><div><span>Rig type</span><b className="fact-highlight">{avatar?.avatarType || rig}</b></div><div><span>User ID</span><b>{avatar?.userId || '—'}</b></div><div><span>Body assets</span><b>{itemsByCategory.length || '—'}</b></div></div>
            <div className="inspector-divider" />
            <div className="inspector-section-title"><span>AVATAR ASSETS</span><span>{itemsByCategory.length}</span></div>
            {itemsByCategory.length ? <div className="asset-list">{itemsByCategory.slice(0, 10).map((asset, i) => <div className="asset-row" key={`${asset.id}-${i}`}><div className="asset-icon">{asset.assetType?.name?.toLowerCase().includes('shirt') ? '▧' : asset.assetType?.name?.toLowerCase().includes('hat') ? '◈' : '◇'}</div><div><b>{asset.name || `Asset ${asset.id}`}</b><small>{asset.assetType?.name || 'Avatar asset'} · {asset.id}</small></div><button title="Open asset in Roblox" onClick={() => window.open(`https://www.roblox.com/catalog/${asset.id}`, '_blank', 'noopener,noreferrer')}><Icon name="arrow" size={13}/></button></div>)}</div> : <div className="inspector-empty"><Icon name="box" size={22}/><span>Load an avatar to inspect its public assets.</span></div>}
            <div className="inspector-divider" />
            <div className="save-look-box"><label htmlFor="look-name">LOOK NAME</label><input id="look-name" value={lookName} onChange={e => setLookName(e.target.value)} maxLength={60}/><button onClick={saveLook} disabled={saving}><Icon name="save" size={15}/>{saving ? 'Saving…' : 'Save current look'}</button><small>Looks sync to your Supabase account when signed in.</small></div>
          </div>
        </section>
        <section className="bottom-note"><div className="bottom-note-icon"><Icon name="sparkle" size={17}/></div><div><b>Built for creators, not just collectors.</b><p>Roblox avatars are read-only in this version. This studio loads public avatar data and lets you stage an outfit draft; it does not modify another user's Roblox account.</p></div><a href="https://www.roblox.com/catalog" target="_blank" rel="noreferrer">Official Catalog <Icon name="arrow" size={13}/></a></section>
      </>}

      {activeTab === 'catalog' && <section className="catalog-page"><div className="page-heading catalog-heading"><div><div className="eyebrow"><span/> ASSET EXPLORER <span className="eyebrow-line"/></div><h1>Find your <em>next look.</em></h1><p>Search Roblox Catalog and stage the items you want to try.</p></div><div className="version-chip"><span>●</span> ROBLOX CATALOG</div></div><form className="catalog-search panel" onSubmit={handleCatalogSearch}><Icon name="search" size={19}/><input value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} placeholder="Search hats, shirts, accessories…"/><button className="button-primary" disabled={catalogBusy}>{catalogBusy ? 'Searching…' : 'Search Catalog'}</button></form>{catalogError && <div className="feedback error">{catalogError}</div>}{catalogItems.length ? <div className="catalog-grid">{catalogItems.map((item, i) => <article className="catalog-card panel" key={`${item.id || item.assetId}-${i}`}><div className="catalog-thumb">{item.thumbnail || item.imageUrl ? <img src={item.thumbnail || item.imageUrl} alt="" loading="lazy"/> : <div className="catalog-placeholder"><Icon name="box" size={28}/></div>}<span>{item.itemType || 'ASSET'}</span></div><div className="catalog-card-body"><b>{item.name || 'Unnamed item'}</b><small>by {item.creatorName || item.creator?.name || 'Roblox Creator'}</small><div className="catalog-card-bottom"><span>{item.price == null ? (item.lowestPrice == null ? 'Price unavailable' : `${item.lowestPrice} R$`) : `${item.price} R$`}</span><button onClick={() => addCatalogItem(item)} aria-label={`Add ${item.name} to draft`}>＋ Add</button></div></div></article>)}</div> : !catalogBusy && <div className="catalog-empty panel"><div className="catalog-empty-orb"><Icon name="box" size={27}/></div><h2>Your next favorite might be here.</h2><p>Enter a keyword above to search public Catalog items. Select an item to add it to your outfit draft.</p><div className="suggestion-chips">{['cyber', 'black hair', 'purple', 'hoodie', 'face'].map(q => <button key={q} onClick={() => { setCatalogQuery(q); searchCatalog(q).then(r => setCatalogItems(r.items || [])).catch(e => setCatalogError(e.message)); }}>{q}</button>)}</div></div>}<div className="catalog-draft-bar"><div><Icon name="shirt" size={18}/><span><b>{draftItems.length} items</b> in your outfit draft</span></div><button className="button-primary" onClick={() => setActiveTab('studio')}>Back to Studio <Icon name="arrow" size={14}/></button></div></section>}

      {activeTab === 'looks' && <section className="looks-page"><div className="page-heading"><div><div className="eyebrow"><span/> YOUR COLLECTION <span className="eyebrow-line"/></div><h1>Saved <em>looks.</em></h1><p>Your personal collection, synced to your Supabase account.</p></div><button className="button-primary" onClick={() => setActiveTab('studio')}>＋ New look</button></div>{!session ? <div className="looks-empty panel"><div className="catalog-empty-orb"><Icon name="heart" size={26}/></div><h2>Your collection lives here.</h2><p>Sign in with email to sync saved outfit drafts across sessions and devices.</p><button className="button-primary" onClick={() => setAuthOpen(true)}>Sign in to Supabase</button>{!supabase && <small>Supabase environment values are missing.</small>}</div> : savedLooks.length ? <div className="looks-grid">{savedLooks.map(look => <article className="look-card panel" key={look.id}><div className="look-card-art"><div className="look-art-orbit"/><div className="look-art-letter">V<span>//</span></div><span>{look.rig} RIG</span></div><div className="look-card-info"><b>{look.name}</b><small>{look.config?.username ? `Avatar @${look.config.username}` : 'Custom outfit draft'}</small><div className="look-card-actions"><span>{look.config?.items?.length || 0} items staged</span><div><button className="load-look-button" onClick={() => loadLook(look)}>Open</button><button onClick={() => deleteLook(look.id)}>Delete</button></div></div></div></article>)}</div> : <div className="looks-empty panel"><div className="catalog-empty-orb"><Icon name="heart" size={26}/></div><h2>No saved looks yet.</h2><p>Open Avatar Studio, build a look, then hit “Save look”.</p><button className="button-primary" onClick={() => setActiveTab('studio')}>Open Studio</button></div>}</section>}
      <footer className="site-footer"><span>VIOLET // AVATAR STUDIO</span><span>UNOFFICIAL COMMUNITY TOOL · NOT AFFILIATED WITH ROBLOX</span><span>BUILD 0.1.0</span></footer>
    </main>

    {authOpen && <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}><section className="auth-modal panel" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close"><Icon name="close"/></button><div className="brand-mark modal-brand"><Icon name="spark" size={22}/></div><div className="eyebrow"><span/> ACCOUNT SYNC</div><h2 id="auth-title">Your looks, <em>everywhere.</em></h2><p>Use a one-time email link to sync saved looks securely with Supabase.</p><form onSubmit={sendLoginLink}><label htmlFor="auth-email">EMAIL ADDRESS</label><input id="auth-email" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" required/><button className="button-primary" type="submit">Send sign-in link <Icon name="arrow" size={15}/></button></form>{authMessage && <div className="auth-message">{authMessage}</div>}<small className="auth-footnote">This signs you into this website only, not into Roblox.</small></section></div>}
  </div>;
}

export default App;
