module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).end(); }
  }

  const message = body?.message;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;
  const text = message.text;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

  const sendMessage = async (msg) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' })
    });
  };

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Clasifica el mensaje en 1-2 etiquetas de: compras, ocio, proyectos, salud, trabajo, personal, otro.
Responde SOLO con JSON: {"etiquetas": ["etiqueta1"], "resumen": "frase breve"}`
          },
          { role: 'user', content: text }
        ]
      })
    });

    const groqData = await groqRes.json();
    const raw = groqData.choices[0].message.content;
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/notas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        mensaje: text,
        etiquetas: parsed.etiquetas,
        resumen: parsed.resumen,
        telefono: String(chatId)
      })
    });

    await sendMessage(`✅ Apuntado como *${parsed.etiquetas.join(', ')}*\n_${parsed.resumen}_`);
    res.status(200).end();

  } catch (err) {
    console.error(err);
    await sendMessage('❌ Error al procesar tu nota. Inténtalo de nuevo.');
    res.status(200).end();
  }
}
