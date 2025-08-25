// api/alice.js
// Вебхук для навыка Алисы на Vercel (Node.js 20+)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Убедимся, что приходят JSON-запросы
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const version = data?.version ?? '1.0';
    const userQuery = data?.request?.original_utterance ?? '';

    // Защита от пустых сообщений
    if (!userQuery || !userQuery.trim()) {
      return res.status(200).json({
        version,
        response: { text: 'Скажи, чем я могу помочь?', end_session: false },
      });
    }

    // Вызов OpenAI Chat Completions (универсально и просто)
    const oaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5', // можешь сменить на gpt-4o для экономии
        messages: [
          {
            role: 'system',
            content:
              'Ты помощник для голосового навыка Алисы. Отвечай кратко и по делу, дружелюбным тоном. Избегай списков, если их не просят.',
          },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.7,
      }),
    });

    if (!oaiResp.ok) {
      const errText = await oaiResp.text();
      console.error('OpenAI error:', errText);
      return res.status(200).json({
        version,
        response: {
          text: 'Сервис ответа сейчас недоступен. Попробуй ещё раз чуть позже.',
          end_session: false,
        },
      });
    }

    const oaiJson = await oaiResp.json();
    let answer =
      oaiJson?.choices?.[0]?.message?.content?.trim() ||
      'Не уверена. Давай попробуем переформулировать вопрос?';

    // Ограничим длину, чтобы TTS Алисы не «спотыкался»
    const MAX = 900;
    if (answer.length > MAX) {
      answer = answer.slice(0, MAX) + '…';
    }

    return res.status(200).json({
      version,
      response: {
        text: answer,
        end_session: false, // оставляем сессию открытой
      },
    });
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(200).json({
      version: '1.0',
      response: {
        text: 'Произошла ошибка при обработке запроса.',
        end_session: false,
      },
    });
  }
}
