// Markdown rendering helpers shared between browser and tests
function escapeHTML(s){
  return (s||"").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function renderMarkdown(text){
  if(!text) return "";

  // Replace explicit Markdown links with tokens so embedded HTML survives
  const linkTokens=[]; let linkIdx=0;
  let tmp = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(m,label,url)=>{
    const token=`__MDLINK_${linkIdx++}__`;
    linkTokens.push({token, html:`<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`});
    return token;
  });

  // Auto-link bare URLs and process basic Markdown for bold/italic.
  tmp = tmp
    .replace(/(https?:\/\/[^\s<)]+)([)\s.,;!?]*)/g,(m,url,trail)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`)
    .replace(/(^|[\s(])((?:www\.)[^\s<)]+)([)\s.,;!?]*)/g,(m,pre,url,trail)=>`${pre}<a href="https://${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`)
    .replace(/(\*\*\*)([\s\S]+?)\1/g, '<strong><em>$2</em></strong>')
    .replace(/(\*\*)([\s\S]+?)\1/g, '<strong>$2</strong>')
    .replace(/(\*)([\s\S]+?)\1/g, '<em>$2</em>');

  // Group blockquotes; recognise lines starting with '>'
  {
    const lines = tmp.split('\n'); const out = []; let buf = [];
    const flush = () => { if (buf.length) { out.push('<blockquote>'+buf.join('<br>')+'</blockquote>'); buf=[]; } };
    for (const raw of lines) {
      const t = raw.trimStart();
      if (t.startsWith('>')) buf.push(t.replace(/^>\s?/, '')); else { flush(); out.push(raw); }
    }
    flush(); tmp = out.join('\n');
  }

  tmp = tmp.replace(/\n/g,'<br>');
  for(const L of linkTokens) tmp = tmp.replaceAll(L.token, L.html);
  return tmp;
}

function stripHtml(html){
  if (typeof document !== 'undefined'){
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || "").trim();
  }
  // Fallback for non-DOM environments (tests)
  return (html || '').replace(/<[^>]*>/g,'').trim();
}

if (typeof window !== 'undefined'){
  window.renderMarkdown = renderMarkdown;
  window.stripHtml = stripHtml;
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = { renderMarkdown, stripHtml };
}
