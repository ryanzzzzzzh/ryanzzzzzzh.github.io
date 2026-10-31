import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, OWNER_UID } from './config.js';

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && OWNER_UID);
let db, user = null, posts = [], active = null;
const status = (message, error = false) => { $('siteStatus').textContent = message; $('siteStatus').className = error ? 'status error' : 'status'; };
const isOwner = () => user?.id === OWNER_UID;
const show = id => { $(id).classList.add('show'); document.body.style.overflow = 'hidden'; };
const close = id => { $(id).classList.remove('show'); document.body.style.overflow = ''; };

function updateOwnerUi() {
  document.querySelectorAll('.owner-only').forEach(el => el.classList.toggle('visible', isOwner()));
  $('loginButton').style.display = isOwner() ? 'none' : '';
}

function safeArticle(html) {
  const allowed = new Set(['P','BR','H2','H3','BLOCKQUOTE','B','STRONG','I','EM','U','S','UL','OL','LI','A','IMG','DIV','SPAN']);
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  // Retain only safe link/image URLs and no event-handler or style attributes.
  function sanitize(node) {
    for (const child of [...node.children]) {
      const href = child.getAttribute('href'); const src = child.getAttribute('src');
      if (!allowed.has(child.tagName)) { child.remove(); continue; }
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (child.tagName === 'A' && href && /^https?:\/\//i.test(href)) { child.href = href; child.rel = 'noopener noreferrer'; child.target = '_blank'; }
      if (child.tagName === 'IMG' && src && /^https?:\/\//i.test(src)) { child.src = src; child.alt = 'Article image'; }
      sanitize(child);
    }
  }
  sanitize(root); return root.innerHTML;
}

function render() {
  const q = $('search').value.toLowerCase();
  const filtered = posts.filter(p => `${p.title} ${p.category} ${p.excerpt}`.toLowerCase().includes(q));
  $('posts').innerHTML = filtered.length ? filtered.map((p, i) => `<article class="card"><div class="cover ${['a','b','c'][i%3]}"></div><div class="cardbody"><div class="meta">${escapeHtml(p.category)} · ${new Date(p.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.excerpt)}</p><div class="cardfoot"><span>By ryanzzzzzzh</span><button class="linkbtn" data-post="${escapeHtml(p.id)}">Read story →</button></div></div></article>`).join('') : '<div class="empty">No stories yet.</div>';
  document.querySelectorAll('[data-post]').forEach(button => button.onclick = () => openPost(button.dataset.post));
}

async function loadPosts() {
  const { data, error } = await db.from('posts').select('id,title,category,excerpt,body,created_at').order('created_at', { ascending: false });
  if (error) return status(`Could not load stories: ${error.message}`, true);
  posts = data || []; render(); status('');
}

async function openPost(id) {
  active = id; const p = posts.find(item => item.id === id); if (!p) return;
  $('readCategory').textContent = p.category; $('readTitle').textContent = p.title;
  $('readDate').textContent = new Date(p.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  $('readBody').innerHTML = safeArticle(p.body);
  const { data: files } = await db.from('attachments').select('id,file_name,storage_path').eq('post_id', id);
  $('readFiles').replaceChildren();
  for (const file of files || []) {
    const link = document.createElement('a'); link.className = 'attachment'; link.textContent = `↓ ${file.file_name}`;
    link.href = db.storage.from('post-attachments').getPublicUrl(file.storage_path).data.publicUrl;
    link.download = file.file_name; $('readFiles').append(link);
  }
  await loadComments(); show('reader');
}

async function loadComments() {
  const { data, error } = await db.from('comments').select('display_name,body,created_at').eq('post_id', active).eq('approved', true).order('created_at');
  if (error) return status(`Could not load comments: ${error.message}`, true);
  $('comments').replaceChildren();
  if (!data?.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'No comments yet. Start the conversation.'; $('comments').append(p); return; }
  for (const c of data) { const box = document.createElement('div'); box.className = 'comment'; const name = document.createElement('strong'); name.textContent = c.display_name; const body = document.createElement('p'); body.textContent = c.body; box.append(name, body); $('comments').append(box); }
}

async function publish() {
  if (!isOwner()) return alert('Only the site owner can publish.');
  const title = $('title').value.trim(), body = safeArticle($('editor').innerHTML);
  if (!title || !$('editor').textContent.trim()) return alert('Add a title and story text first.');
  $('publish').disabled = true;
  try {
    const { data: post, error } = await db.from('posts').insert({ title, body, category: $('category').value.trim() || 'Journal', excerpt: $('excerpt').value.trim() || $('editor').textContent.trim().slice(0, 150), author_id: OWNER_UID }).select('id').single();
    if (error) throw error;
    for (const file of $('files').files) {
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB attachment limit.`);
      const path = `${post.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploaded = await db.storage.from('post-attachments').upload(path, file);
      if (uploaded.error) throw uploaded.error;
      const recorded = await db.from('attachments').insert({ post_id: post.id, file_name: file.name, storage_path: path });
      if (recorded.error) throw recorded.error;
    }
    $('title').value = $('category').value = $('excerpt').value = $('files').value = '';
    $('editor').innerHTML = ''; $('fileNames').textContent = ''; close('compose'); await loadPosts();
  } catch (error) { alert(`Could not publish: ${error.message}`); } finally { $('publish').disabled = false; }
}

async function deletePost() {
  if (!isOwner() || !active || !confirm('Delete this story, its comments, and attachments?')) return;
  const { data: files } = await db.from('attachments').select('storage_path').eq('post_id', active);
  const { error } = await db.from('posts').delete().eq('id', active);
  if (error) return alert(`Could not delete: ${error.message}`);
  if (files?.length) await db.storage.from('post-attachments').remove(files.map(f => f.storage_path));
  close('reader'); active = null; await loadPosts();
}

document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => close(button.dataset.close));
document.querySelectorAll('.overlay').forEach(overlay => overlay.addEventListener('click', e => { if (e.target === overlay) close(overlay.id); }));
$('search').oninput = render;
$('newPost').onclick = () => show('compose'); $('loginButton').onclick = () => show('auth');
$('publish').onclick = publish; $('deletePost').onclick = deletePost;
$('files').onchange = () => $('fileNames').textContent = [...$('files').files].map(f => f.name).join(', ');
document.querySelectorAll('[data-cmd]').forEach(button => button.onclick = () => {
  const cmd = button.dataset.cmd;
  let value = null;
  if (cmd === 'createLink' || cmd === 'insertImage') value = prompt(cmd === 'createLink' ? 'Enter a web URL:' : 'Enter an image URL:');
  if ((cmd === 'createLink' || cmd === 'insertImage') && !/^https?:\/\//i.test(value || '')) return;
  $('editor').focus(); document.execCommand(cmd, false, value);
});
$('format').onchange = e => { $('editor').focus(); document.execCommand('formatBlock', false, e.target.value); };
$('addComment').onclick = async () => {
  const display_name = $('commentName').value.trim(), body = $('commentText').value.trim();
  if (!display_name || !body) return alert('Add your name and comment first.');
  const { error } = await db.from('comments').insert({ post_id: active, display_name, body });
  if (error) return alert(`Could not submit comment: ${error.message}`);
  $('commentName').value = $('commentText').value = '';
  alert('Your comment was submitted for review.');
};
$('sendLink').onclick = async () => {
  const email = $('email').value.trim(); if (!email) return;
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0], shouldCreateUser: false } });
  $('authStatus').textContent = error ? error.message : 'Check your email for the sign-in link.';
  $('authStatus').className = error ? 'status error' : 'status success';
};
$('logoutButton').onclick = async () => { await db.auth.signOut(); user = null; updateOwnerUi(); };

if (!configured) {
  $('loginButton').style.display = 'none';
  status('Site setup is pending. Add your Supabase project details to config.js, then run schema.sql in Supabase.', true);
} else {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data } = await db.auth.getUser(); user = data.user; updateOwnerUi();
    db.auth.onAuthStateChange((_event, session) => { user = session?.user || null; updateOwnerUi(); });
    await loadPosts();
  } catch (error) { status(`Site setup error: ${error.message}`, true); }
}

