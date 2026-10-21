// Busca foto, nome e preço de um produto a partir do link (Função da Vercel)
const PERMITIDOS = ['s.shopee.com.br', 'shopee.com.br', 'shp.ee', 'mercadolivre.com.br', 'meli.la', 'mercadolibre.com'];
const dec = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
function meta(h, p) {
  const a = new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]*?content=["\']([^"\']*)["\']', 'i');
  const b = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*?(?:property|name)=["\']' + p + '["\']', 'i');
  const m = h.match(a) || h.match(b);
  return m ? dec(m[1]) : '';
}
module.exports = async (req, res) => {
  let u;
  try { u = new URL(String(req.query.url || '')); } catch (e) { return res.status(400).json({ erro: 'link inválido' }); }
  const ok = u.protocol === 'https:' && PERMITIDOS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  if (!ok) return res.status(400).json({ erro: 'loja não permitida' });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(u.href, {
      redirect: 'follow', signal: ctl.signal,
      headers: { 'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'accept-language': 'pt-BR,pt;q=0.9', accept: 'text/html' }
    });
    const h = (await r.text()).slice(0, 400000);
    let preco = meta(h, 'product:price:amount') || meta(h, 'og:price:amount');
    if (!preco) { const m = h.match(/"(?:lowPrice|price)"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)"?/); if (m) preco = m[1]; }
    if (preco) {
      const n = parseFloat(String(preco).replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
      if (!isNaN(n)) preco = 'R$ ' + n.toFixed(2).replace('.', ',');
    }
    let desc = (meta(h, 'og:description') || meta(h, 'description')).replace(/\s+/g, ' ');
    if (desc.length > 160) desc = desc.slice(0, 160).replace(/\s+\S*$/, '') + '…';
    const out = { nome: meta(h, 'og:title'), img: meta(h, 'og:image'), preco, desc, final: r.url, status: r.status };
    if (!out.img && !out.preco && !out.desc) return res.status(200).json({ erro: 'sem dados', final: r.url, status: r.status });
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ erro: 'falha ao abrir o link' });
  } finally { clearTimeout(t); }
};
