import express from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDb,
  query,
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getTodayReviews,
  saveGrade,
  rateCard,
  getStatistics,
  clearAllTables
} from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper: Call LLM API securely
async function callLLM(systemPrompt, userPrompt) {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_API_MODEL || 'gpt-4o-mini';
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.2');

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured in the server environment.');
  }

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Provider HTTP Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'LLM API error');
  }

  return data.choices[0].message.content;
}

// Helper: Auto-split standard answer into score points using AI
async function aiSplitScorePoints(question, standardAnswer) {
  try {
    const systemPrompt = `你是一位专业的考研专业课辅导老师。请根据给出的题目和标准答案，拆分出3至6个清晰、独立的判定得分点（Score Points）。
这些得分点是判卷时必须看到的关键核心信息或得分关键词。
你必须输出且仅输出一个合法的 JSON 格式对象，结构如下：
{
  "score_points": ["得分点1详细描述", "得分点2详细描述", "得分点3详细描述"]
}
不要有任何 Markdown 包裹（不要 \`\`\`json），直接输出 JSON 内容。`;
    const userPrompt = `题目：${question}\n标准答案：${standardAnswer}`;
    
    const resText = await callLLM(systemPrompt, userPrompt);
    const parsed = JSON.parse(resText.trim());
    return parsed.score_points || [];
  } catch (error) {
    console.warn('AI score points split failed, falling back to sentence split:', error.message);
    // Simple sentence split fallback
    return standardAnswer
      .split(/[。！；;!?\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 8);
  }
}

// ----------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------

// 1. Get Questions list (with filtering)
app.get('/api/questions', async (req, res) => {
  try {
    const filters = {
      subject: req.query.subject,
      chapter: req.query.chapter,
      type: req.query.type,
      search: req.query.search
    };
    const data = await getQuestions(filters);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get Question Details
app.get('/api/questions/:id', async (req, res) => {
  try {
    const data = await getQuestion(parseInt(req.params.id));
    if (!data) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Create Question
app.post('/api/questions', async (req, res) => {
  try {
    const q = req.body;
    
    // Auto-populating default values for backward compatibility
    if (!q.full_answer && q.standard_answer) q.full_answer = q.standard_answer;
    if (!q.cloze_answer && q.standard_answer) q.cloze_answer = q.standard_answer;
    
    if (!q.cloze_answer) q.cloze_answer = q.question || '';
    if (!q.full_answer) q.full_answer = q.question || '';
    
    if (!q.cloze_keywords || q.cloze_keywords.length === 0) {
      const keywords = [];
      const regex = /\*\*(.*?)\*\*/g;
      let match;
      while ((match = regex.exec(q.cloze_answer)) !== null) {
        const kw = match[1].trim();
        if (kw && !keywords.includes(kw)) {
          keywords.push(kw);
        }
      }
      q.cloze_keywords = keywords;
    }

    if (!q.full_score_points || q.full_score_points.length === 0) {
      q.full_score_points = q.full_answer.split(/[。！；;!?\n]/).map(s => s.trim()).filter(s => s.length > 4);
    }

    const questionId = await createQuestion(q);
    res.json({ success: true, message: 'Question created successfully', questionId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Update Question
app.put('/api/questions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await updateQuestion(id, req.body);
    res.json({ success: true, message: 'Question updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Delete Question
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await deleteQuestion(id);
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Get Spaced Repetition Study Queue
app.get('/api/today-reviews', async (req, res) => {
  try {
    const data = await getTodayReviews();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Secure AI Grading API with DB History Logging (Combined Grading)
app.post('/api/ai/grade', async (req, res) => {
  try {
    const { questionId, clozeScore, clozeAnswers, fullAnswerInput } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, message: 'questionId is required' });
    }

    // Retrieve question data
    const questionData = await getQuestion(parseInt(questionId));
    if (!questionData) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const clozeGrade = parseFloat(clozeScore !== undefined ? clozeScore : 0);

    let gradingResult;

    // Call AI if enabled, otherwise fallback to local keyword matching
    if (process.env.AI_API_KEY && process.env.ENABLE_AI_GRADING !== 'false') {
      try {
        const systemPrompt = `你是一位专业的考研专业课阅卷教师。你需要对【论述题部分】的学生作答进行评审和评分（0-10分制，评分必须为整数）。

论述题评分原则（较为严格）：
- 强调全面性与论述深度：学生必须尽可能答出标准答案的所有核心要点和组成部分。
- 细节比对：深入对比标准答案的全部细节展开，漏掉重要逻辑步骤或展开不够全面都要扣分。

你必须输出且仅输出一个合法的 JSON 格式对象，结构如下：
{
  "full_evaluation": {
    "score": 7,
    "full_score": 10,
    "level": "基本掌握",
    "covered_points": ["细节阐述充分的第1个要点", "细节阐述充分的第2个要点"],
    "missing_points": ["遗漏或阐述过于简略的第1个要点", "遗漏或阐述过于简略的第2个要点"],
    "wrong_points": ["表述错误、概念偏离或存在逻辑漏洞的内容"],
    "suggestion": "关于论述题深度、论证逻辑或补充细节的改进建议",
    "exam_comment": "论述题深度短评，字数在100字以内"
  }
}
不要有任何 Markdown 包裹（不要用 \`\`\`json 或者是 \`\`\`），直接输出 JSON 内容。`;

        const userPrompt = `题目：${questionData.question}

【论述题标准参考答案】：
${questionData.full_answer}
【论述题细节得分点】：
${JSON.stringify(questionData.full_score_points || [])}

--------------------
【学生作答论述题】：
"${fullAnswerInput || '（学生未作答）'}"`;

        const aiText = await callLLM(systemPrompt, userPrompt);
        gradingResult = JSON.parse(aiText.trim());
      } catch (err) {
        console.error('LLM API call failed, falling back to local grader:', err);
        gradingResult = runLocalBiFallbackGrader(fullAnswerInput, questionData);
      }
    } else {
      // Fallback
      gradingResult = runLocalBiFallbackGrader(fullAnswerInput, questionData);
    }

    const fullScore = gradingResult.full_evaluation?.score !== undefined ? gradingResult.full_evaluation.score : 0;

    // Calculate total score based on weights: Cloze 40%, Essay (Full) 60%
    const totalScore = parseFloat(((clozeGrade * 0.40) + (fullScore * 0.60)).toFixed(2));

    const scores = {
      clozeScore: clozeGrade,
      fullScore,
      totalScore
    };

    const inputs = {
      clozeAnswers,
      fullAnswerInput
    };

    // Save attempt and update database review states
    await saveGrade(questionId, scores, inputs, gradingResult);

    res.json({
      success: true,
      data: {
        clozeScore: clozeGrade,
        fullScore,
        totalScore,
        full_evaluation: gradingResult.full_evaluation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper: Local scoring fallback for essay answers
function runLocalBiFallbackGrader(fullAnswerInput, questionData) {
  const fullPoints = questionData.full_score_points || [];
  const fullGrading = runLocalSingleGrader(fullAnswerInput, fullPoints, "论述题");
  
  return {
    full_evaluation: fullGrading
  };
}

function runLocalSingleGrader(input, points, modeName) {
  const cleanInput = (input || '').toLowerCase().trim();
  if (!cleanInput) {
    return {
      score: 0,
      full_score: 10,
      level: "完全不会",
      covered_points: [],
      missing_points: points,
      wrong_points: ["作答为空"],
      suggestion: "请认真书写答案后再提交评分。",
      exam_comment: `[本地评分] 未检测到您的${modeName}作答内容。`
    };
  }
  
  const matches = [];
  const misses = [];
  
  points.forEach(point => {
    const cleanedPoint = point.toLowerCase();
    const subsegments = cleanedPoint.split(/[,，().（）]/).filter(s => s.trim().length > 3);
    const matched = subsegments.length > 0 
      ? subsegments.some(sub => cleanInput.includes(sub.trim())) 
      : cleanInput.includes(cleanedPoint);
      
    if (matched) {
      matches.push(point);
    } else {
      misses.push(point);
    }
  });
  
  const scoreRatio = points.length > 0 ? (matches.length / points.length) : 0.5;
  const score = Math.round(scoreRatio * 10);
  
  let level = "完全不会";
  if (score >= 9) level = "熟练掌握";
  else if (score >= 7) level = "基本掌握";
  else if (score >= 5) level = "模糊印象";
  else if (score >= 2) level = "稍微了解";
  
  return {
    score,
    full_score: 10,
    level,
    covered_points: matches,
    missing_points: misses,
    wrong_points: [],
    suggestion: `[本地评分] 下次请重点关注：${misses.slice(0, 2).join('; ')}`,
    exam_comment: `[本地评分] 答出 ${matches.length}/${points.length} 个关键得分点。`
  };
}

// 8. Leitner self-rating rating sync
app.post('/api/cards/rate', async (req, res) => {
  try {
    const { questionId, rating } = req.body;
    if (!questionId || !rating) {
      return res.status(400).json({ success: false, message: 'questionId and rating are required' });
    }
    await rateCard(parseInt(questionId), rating);
    res.json({ success: true, message: 'Card rating saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8.5. Save Cloze test results (Keep route for compatibility)
app.post('/api/cloze/grade', async (req, res) => {
  try {
    const { questionId, score, answers, result } = req.body;
    if (!questionId || score === undefined || !result) {
      return res.status(400).json({ success: false, message: 'questionId, score, and result are required' });
    }
    const userAnswer = `[填空自测] 答案记录: ${JSON.stringify(answers)}`;
    const scores = {
      clozeScore: score,
      fullScore: score,
      totalScore: score
    };
    const inputs = {
      clozeAnswers: answers,
      fullAnswerInput: userAnswer
    };
    await saveGrade(parseInt(questionId), scores, inputs, { result });
    res.json({ success: true, message: 'Cloze test result saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. Get Statistics & Weakness reports
app.get('/api/statistics', async (req, res) => {
  try {
    const stats = await getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. Admin: Import questions from Markdown / JSON
app.post('/api/questions/import', async (req, res) => {
  try {
    const { format, content } = req.body;
    let importCount = 0;

    if (format === 'json') {
      const parsed = Array.isArray(content) ? content : JSON.parse(content);
      for (const q of parsed) {
        const cloze_answer = q.cloze_answer || q.standard_answer || q.description || '';
        const full_answer = q.full_answer || q.standard_answer || q.description || '';

        // Extract cloze keywords if not provided
        let cloze_keywords = q.cloze_keywords || q.keywords || [];
        if (cloze_keywords.length === 0 && cloze_answer) {
          const regex = /\*\*(.*?)\*\*/g;
          let kwMatch;
          while ((kwMatch = regex.exec(cloze_answer)) !== null) {
            const kw = kwMatch[1].trim();
            if (kw && !cloze_keywords.includes(kw)) {
              cloze_keywords.push(kw);
            }
          }
        }

        const full_score_points = q.full_score_points || q.score_points || 
          full_answer.split(/[。！；;!?\n]/).map(s => s.trim()).filter(s => s.length > 5);

        await createQuestion({
          question: q.question || q.title,
          subject: q.subject || '专业课',
          chapter: q.chapter || '未分类',
          cloze_answer,
          cloze_keywords,
          full_answer,
          full_score_points,
          difficulty: q.difficulty || 3,
          importance: q.importance || 3
        });
        importCount++;
      }
    } else if (format === 'markdown') {
      // Parse markdown contents
      const lines = content.split(/\r?\n/);
      let currentSubject = '专业课';
      let currentChapter = '未分类';

      // We parse headings and list structures
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Subject / Chapter parsing
        if (line.startsWith('# ')) {
          currentSubject = line.replace('# ', '').trim();
          continue;
        }
        if (line.startsWith('## ')) {
          currentChapter = line.replace(/^##\s*(📅)?\s*/, '').trim();
          continue;
        }

        // Check for Markdown flashcard: e.g. * **term**：definition
        const flashcardMatch = line.match(/^([*\-+]$|^\*|^\d+\.)\s+(.*)/);
        if (flashcardMatch) {
          const itemContent = flashcardMatch[2].trim();
          const termMatch = itemContent.match(/^(?:\*\*|\*)(.*?)(?:\*\*|\*)\s*(.*?)\s*[：:]\s*(.*)/);
          
          if (termMatch) {
            const concept = termMatch[1].trim();
            const subTerm = termMatch[2].trim();
            const fullConcept = subTerm ? `${concept} (${subTerm})` : concept;
            const description = termMatch[3].trim();
            
            // Extract bold keywords
            const keywords = [];
            const regex = /\*\*(.*?)\*\*/g;
            let kwMatch;
            while ((kwMatch = regex.exec(description)) !== null) {
              const kw = kwMatch[1].trim();
              if (kw && !keywords.includes(kw)) {
                keywords.push(kw);
              }
            }

            const points = description.split(/[。！；;!?\n]/).map(s => s.trim()).filter(s => s.length > 5);

            await createQuestion({
              question: fullConcept,
              subject: currentSubject,
              chapter: currentChapter,
              cloze_answer: description,
              cloze_keywords: keywords,
              full_answer: description,
              full_score_points: points,
              difficulty: 3,
              importance: 3
            });
            importCount++;
          }
        } else if (line.startsWith('### ')) {
          // Parse header items: e.g. ### 1. 地理数据和地理信息
          const rawTitle = line.replace('### ', '').trim();
          const match = rawTitle.match(/^(\d+)\.\s*(.*)/);
          const title = match ? match[2] : rawTitle;

          // Read body lines until next heading
          let bodyLines = [];
          let scorePoints = [];
          let nextIdx = i + 1;
          while (nextIdx < lines.length && !lines[nextIdx].trim().startsWith('##')) {
            const nextLine = lines[nextIdx].trim();
            if (nextLine) {
              if (nextLine.startsWith('* ') || nextLine.startsWith('- ') || /^\d+\./.test(nextLine)) {
                const pt = nextLine.replace(/^(\*\s*|-\s*|\d+\.\s*)/, '').trim();
                scorePoints.push(pt);
              } else {
                bodyLines.push(nextLine);
              }
            }
            nextIdx++;
          }
          i = nextIdx - 1; // Advance main loop

          const normalParagraphsText = bodyLines.join('\n');
          const bulletPointsText = scorePoints.map((pt, idx) => `${idx + 1}. ${pt}`).join('\n');
          
          let fullAnswer = '';
          if (normalParagraphsText && bulletPointsText) {
            fullAnswer = normalParagraphsText + '\n\n' + bulletPointsText;
          } else {
            fullAnswer = normalParagraphsText || bulletPointsText;
          }

          const clozeAnswer = fullAnswer;
          const keywords = [];
          const regex = /\*\*(.*?)\*\*/g;
          let kwMatch;
          while ((kwMatch = regex.exec(clozeAnswer)) !== null) {
            const kw = kwMatch[1].trim();
            if (kw && !keywords.includes(kw)) {
              keywords.push(kw);
            }
          }

          let fullScorePoints = [];
          if (scorePoints.length > 0) {
            fullScorePoints = [...scorePoints];
          }
          if (normalParagraphsText) {
            const extraPoints = normalParagraphsText.split(/[。！；;!?\n]/).map(s => s.trim()).filter(s => s.length > 5);
            fullScorePoints = [...fullScorePoints, ...extraPoints];
          }
          if (fullScorePoints.length === 0) {
            fullScorePoints = ['请补全详细论述得分点'];
          }

          await createQuestion({
            question: title,
            subject: currentSubject,
            chapter: currentChapter,
            cloze_answer: clozeAnswer,
            cloze_keywords: keywords,
            full_answer: fullAnswer,
            full_score_points: fullScorePoints,
            difficulty: 3,
            importance: 3
          });
          importCount++;
        }
      }
    }

    res.json({ success: true, message: `Successfully imported ${importCount} questions.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. Admin: Export questions to JSON
app.get('/api/questions/export', async (req, res) => {
  try {
    const data = await getQuestions();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12. Admin: Clear database (for reset/re-sync)
app.post('/api/questions/clear', async (req, res) => {
  try {
    await clearAllTables();
    res.json({ success: true, message: 'All database tables cleared successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. Admin: AI Import helper
app.post('/api/questions/import-ai', async (req, res) => {
  try {
    const { text, defaultSubject, defaultChapter } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'No text content provided.' });
    }

    const systemPrompt = `你是一位专业的GIS（地理信息系统）考研专业课辅导老师。请解析用户提供的专业课背诵文本（包含从 Word/Markdown 导入的原始内容，已用 **加粗标出核心词**）。
注意：你必须且只能将用户给出的这段文本作为一个整体，整理成一张且仅有一张背诵卡片（切记：绝对不能将文本拆分为多个子卡片或小问题！必须是整段内容合并为一张卡片，其题目 question 必须使用整段大题的标题）。

构建如下 JSON 格式对象：
1. "question": 大题的标题/概念名称（例如："地理数据和地理信息"、"地理数据的特征"、"地理信息系统的基本特征"）。不要包含数字序号（如去掉 "1、"）。
2. "subject": 学科科目名称，如果没有从文中识别出，默认使用 "${defaultSubject || '专业课'}"。
3. "chapter": 章节名称（例如："地理信息系统基础理论"、"GIS组成、功能与应用"）。如果从文中识别出如“X月X日背诵内容：XXX”，请以 “XXX” 作为章节名。如果没有识别出，默认使用 "${defaultChapter || '未分类'}"。
4. "cloze_answer": 填空背诵要点。将原本文本的所有内容完整保留，同时必须保留原本的加粗格式（使用 **加粗核心词**），用于填空时挖空这些加粗词。
5. "cloze_keywords": 从 cloze_answer 中提取的所有被 ** 包裹的关键词数组（例如：["空间分布性", "空间定位"]），去除星号本身。
6. "full_answer": 论述展开细节。包含这道大题的全部详细展开内容，字数要求饱满详实。
7. "full_score_points": 详细得分点数组。用于与用户的长答案进行匹配打分（通常是各个大要点及其核心解释的组合，例如：["空间相关性：空间依赖性（地理学第一定律）", "空间区域性：按区域组织应用"]）。
8. "difficulty": 难度 (1-5 整数，默认3)。
9. "importance": 重要度 (1-5 整数，默认3)。

你必须输出且仅输出一个包含唯一卡片对象的 JSON 格式对象，结构如下：
{
  "questions": [
    {
      "question": "...",
      "subject": "...",
      "chapter": "...",
      "cloze_answer": "...",
      "cloze_keywords": ["...", "..."],
      "full_answer": "...",
      "full_score_points": ["...", "..."],
      "difficulty": 3,
      "importance": 3
    }
  ]
}
不要有任何 Markdown 包裹（不要使用 \`\`\`json 标记），直接输出 JSON 内容。`;

    const userPrompt = `需要解析的文本内容如下：\n\n${text}`;

    console.log("Calling LLM for AI Import, text length:", text.length);
    const aiResponse = await callLLM(systemPrompt, userPrompt);
    
    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(aiResponse.trim());
    } catch (parseErr) {
      console.error("Failed to parse LLM JSON response. Response was:", aiResponse);
      // Try cleaning up any markdown block wrappers if LLM still output them
      const cleaned = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed || !parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid AI response structure. Expected 'questions' array.");
    }

    let importCount = 0;
    for (const q of parsed.questions) {
      // Create each question in database
      await createQuestion({
        question: q.question,
        subject: q.subject || defaultSubject || '专业课',
        chapter: q.chapter || defaultChapter || '未分类',
        cloze_answer: q.cloze_answer,
        cloze_keywords: q.cloze_keywords || [],
        full_answer: q.full_answer,
        full_score_points: q.full_score_points || [],
        difficulty: parseInt(q.difficulty || '3') || 3,
        importance: parseInt(q.importance || '3') || 3
      });
      importCount++;
    }

    res.json({ success: true, message: `Successfully imported ${importCount} questions via AI.`, count: importCount });
  } catch (error) {
    console.error("AI Import failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------
// FRONTEND HOSTING
// ----------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*all', (req, res) => {
  const indexHtml = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send('Frontend build not found. Running in API-only mode.');
  }
});

// Initialize DB schema and start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Fatal: Database initialization failed!', err);
    process.exit(1);
  });
