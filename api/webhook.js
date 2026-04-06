import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: true,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const message = req.body?.message;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;
  const text = message.text;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

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
            content: `Eres un asistente de organización personal. El usuario te manda notas y pensamientos.
Tu tarea es clasificar el mensaje en UNA o DOS etiquetas de esta lista: compras, ocio, proyectos, salud, trabajo, personal, otro.
Responde SOLO con JSON sin explicaciones:
{"etiquetas": ["etiqueta1"], "resumen": "resumen breve en una frase"}`
          },
          {
            role: 'user',
            content: text
          }
        ]
      })
    });

    const groqData = await groqRes.json();
    console.log('GROQ RESPONSE:', JSON.stringify(groqData));
    const raw = groqData.choices[0].message.content;
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    await supabase.from('notas').insert({
      mensaje: text,
      etiquetas: parsed.etiquetas,
      resumen: parsed.resumen,
      telefono: String(chatId)
    });

    const reply = `✅ Apuntado como *${parsed.etiquetas.join(', ')}*\n_${parsed.resumen}_`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
        parse_mode: 'Markdown'
      })
    });

    res.status(200).end();

  } catch (err) {
    console.error(err);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '❌ Error al procesar tu nota. Inténtalo de nuevo.'
      })
    });
    res.status(200).end();
  }
}
