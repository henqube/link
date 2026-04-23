export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const DB_IDS = {
    title:  process.env.NOTION_TITLE_DB_ID,
    top:    process.env.NOTION_TOP_DB_ID,
    body:   process.env.NOTION_BODY_DB_ID,
    footer: process.env.NOTION_FOOTER_DB_ID,
  };

  async function queryDB(dbId) {
    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const data = await r.json();
    return data.results || [];
  }

  function getFile(prop) {
    if (!prop || prop.type !== 'files' || !prop.files?.length) return null;
    const f = prop.files[0];
    return f.type === 'external' ? f.external.url : f.file.url;
  }

  function getRichText(prop) {
    if (!prop) return '';
    if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') || '';
    if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') || '';
    return '';
  }

  function getUrl(prop) {
    if (!prop || prop.type !== 'url') return '';
    return prop.url || '';
  }

  try {
    const [titleRows, topRows, bodyRows, footerRows] = await Promise.all([
      queryDB(DB_IDS.title),
      queryDB(DB_IDS.top),
      queryDB(DB_IDS.body),
      queryDB(DB_IDS.footer),
    ]);

    const title = titleRows.map(row => ({
      thumb: getFile(row.properties.thumb),
      text:  getRichText(row.properties.text || row.properties.Name || row.properties.title),
    }))[0] || {};

    const top = topRows.map(row => ({
      thumb: getFile(row.properties.thumb),
      text:  getRichText(row.properties.text || row.properties.Name || row.properties.title),
      link:  getUrl(row.properties.link),
    }))[0] || {};

    const body = bodyRows.map(row => ({
      text: getRichText(row.properties.text || row.properties.Name || row.properties.title),
      link: getUrl(row.properties.link),
    }));

    const footer = {};
    footerRows.forEach(row => {
      const key = getRichText(row.properties.key || row.properties.Name || row.properties.title);
      const value = getRichText(row.properties.value);
      if (key) footer[key] = value;
    });

    res.status(200).json({ title, top, body, footer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
