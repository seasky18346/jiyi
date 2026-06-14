export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { concept, description, keywords, userAnswer, apiKey, apiUrl, apiModel } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'API Key is required' });
    }

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          {
            role: 'system',
            content: `你是一位专业的测绘地理信息学考研专业课教师。请对比标准答案与学生的默写，进行智能语义评估打分（0-100分）。
请允许同义词、近义词或句式不同的表达（例如把“大地球体”写成“参考地球椭球体”）。
你必须输出且仅输出一个合法的 JSON 格式对象，结构如下：
{
  "score": 85,
  "comments": "简短的中肯评语，说明哪些点答得好，哪些得分核心词遗漏了。字数控制在100字以内。",
  "synonyms": [{"student": "学生用的词", "standard": "对应的标准关键词"}]
}
不要有任何 Markdown 包裹（不要 \`\`\`json），直接输出 JSON 内容。`
          },
          {
            role: 'user',
            content: `名词：${concept}\n标准答案：${description}\n必须包含的得分核心词：${keywords.join(', ')}\n学生的默写回答：${userAnswer}`
          }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ success: false, message: data.error.message || 'API error' });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
