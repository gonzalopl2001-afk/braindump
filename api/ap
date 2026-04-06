import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { Body, From } = req.body;

  if (!Body) return res.status(400).end();

  try {
    // Clasificar con Groq
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente de organización personal. El usuario te manda notas y pensamientos por WhatsApp.
Tu tarea es clasificar el mensaje en UNA o DOS etiquetas de esta lista: compras, ocio, proyectos, salud, trabajo, personal, otro.
Responde SOLO con JSON, sin explicaciones:
{"etiquetas": ["etiqueta1"], "resumen": "resumen breve en una frase"}`
          },
          {
            role: 'user',
            content: Body
          }
        ]
      })
    });

    const groqData = await groqRes.json();
    const raw = groqData.choices[0].message.content;
    const parsed = JSON.parse(raw);

    // Guardar en Supabase
    await supabase.from('notas').insert({
      mensaje: Body,
      etiquetas: parsed.etiquetas,
      resumen: parsed.resumen,
      telefono: From
    });

    // Responder a WhatsApp
    const reply = `✅ Apuntado como *${parsed.etiquetas.join(', ')}*\n_${parsed.resumen}_`;

    res.setHeader('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`);

  } catch (err) {
    console.error(err);
    res.setHeader('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Error al procesar tu nota. Inténtalo de nuevo.</Message>
</Response>`);
  }
}
