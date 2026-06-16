import express from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
  clearAllTables,
  createUser,
  getUserByUsername,
  getUserById,
  toggleWeakCard
} from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware: Verify JWT Access Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access-secret-key-123456', (err, user) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
    }
    req.user = user;
    next();
  });
}

// ----------------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------------------

// 1. Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;

    if (!username || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: '用户名、密码与确认密码不能为空' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: '两次输入的密码不一致' });
    }

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已被占用' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await createUser(username, passwordHash);
    res.status(201).json({
      success: true,
      message: '注册成功',
      user: { id: newUser.id, username: newUser.username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_ACCESS_SECRET || 'access-secret-key-123456',
      { expiresIn: '2d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-123456',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Refresh Access Token (using Refresh Token)
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-123456', (err, decoded) => {
      if (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      }

      const accessToken = jwt.sign(
        { userId: decoded.userId, username: decoded.username },
        process.env.JWT_ACCESS_SECRET || 'access-secret-key-123456',
        { expiresIn: '2d' }
      );

      res.json({ success: true, accessToken });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Refresh Long/Refresh Token (extend 7-day sliding window, using valid Access Token)
app.post('/api/auth/refresh-long', authenticateToken, async (req, res) => {
  try {
    const refreshToken = jwt.sign(
      { userId: req.user.userId, username: req.user.username },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-123456',
      { expiresIn: '7d' }
    );
    res.json({ success: true, refreshToken });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper: Call LLM API securely
async function callLLM(systemPrompt, userPrompt, customModel) {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1';
  const defaultModel = process.env.AI_API_MODEL || 'gpt-4o-mini';
  const model = customModel || defaultModel;
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
app.get('/api/questions', authenticateToken, async (req, res) => {
  try {
    const filters = {
      subject: req.query.subject,
      chapter: req.query.chapter,
      type: req.query.type,
      search: req.query.search
    };
    const data = await getQuestions(req.user.userId, filters);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get Question Details
app.get('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const data = await getQuestion(parseInt(req.params.id), req.user.userId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Create Question
app.post('/api/questions', authenticateToken, async (req, res) => {
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
app.put('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await updateQuestion(id, req.body);
    res.json({ success: true, message: 'Question updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Delete Question
app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await deleteQuestion(id);
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Get Spaced Repetition Study Queue
app.get('/api/today-reviews', authenticateToken, async (req, res) => {
  try {
    const data = await getTodayReviews(req.user.userId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Secure AI Grading API with DB History Logging (Combined Grading)
app.post('/api/ai/grade', authenticateToken, async (req, res) => {
  try {
    const { questionId, clozeScore, clozeAnswers, fullAnswerInput, skipAI } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, message: 'questionId is required' });
    }

    // Retrieve question data
    const questionData = await getQuestion(parseInt(questionId), req.user.userId);
    if (!questionData) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const clozeGrade = parseFloat(clozeScore !== undefined ? clozeScore : 0);

    let gradingResult;

    // Call AI if enabled and not skipped, otherwise fallback to local keyword matching
    if (!skipAI && process.env.AI_API_KEY && process.env.ENABLE_AI_GRADING !== 'false') {
      try {
        const systemPrompt = `你是一位专业的考研专业课记忆强化教练。你需要对【论述题部分】的学生作答与标准得分点进行比对，指出必背遗漏和错误，并给出一句话记忆提示。
评分规则（0-10分制，必须为整数）：
- 请采用【非常宽松】的评判标准。不要吹毛求疵，不需要字词完全一致。
- 只要学生回答的内容中，意思、概念、逻辑与大纲标准得分点相近（包括使用近义词、同义词、表述方式不同但内涵一致），就应该算作“已命中”该得分点。
- 只有在内容完全偏离、牛头不对马嘴、或者完全没有提及某得分点时，才算作“遗漏得分点”。
- 根据学生已命中得分点所占比例，给出 0-10 的整数评分。

你必须输出且仅输出一个合法的 JSON 格式对象，结构如下：
{
  "full_evaluation": {
    "score": 7,
    "missing_points": ["遗漏得分点1", "遗漏得分点2"],
    "wrong_points": ["概念表述有偏离的要点"],
    "suggestion": "一句话核心背诵提示（必须在30个字以内，供下次复习记忆）"
  }
}
要求：
- missing_points 和 wrong_points 中的每一项必须是极简短的短语（不超过15个字），不要写为什么错，也不要长句解释。
- suggestion 必须是极简短的、可以直接用于下一次背诵的核心记忆锚点。
- 不要有任何 Markdown 包裹（不要 \`\`\`json ），直接输出 JSON 内容。`;

        const userPrompt = `题目：${questionData.question}

【大纲标准得分点】：
${JSON.stringify(questionData.full_score_points || [])}

--------------------
【学生作答论述题】：
"${fullAnswerInput || '（未作答）'}"`;

        const aiText = await callLLM(systemPrompt, userPrompt, process.env.AI_API_MODEL_GRADER);
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
    await saveGrade(req.user.userId, questionId, scores, inputs, gradingResult);

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
      missing_points: points,
      wrong_points: ["未作答"],
      suggestion: "请认真书写答案后再提交评分。"
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
  
  return {
    score,
    missing_points: misses,
    wrong_points: [],
    suggestion: misses.length > 0 
      ? `核心必背词: ${misses.slice(0, 2).join('; ')}`
      : "本题回答理想，继续保持"
  };
}

// 8. Leitner self-rating rating sync
app.post('/api/cards/rate', authenticateToken, async (req, res) => {
  try {
    const { questionId, rating, clozeAnswers, fullAnswerInput } = req.body;
    if (!questionId || !rating) {
      return res.status(400).json({ success: false, message: 'questionId and rating are required' });
    }
    await rateCard(req.user.userId, parseInt(questionId), rating, { clozeAnswers, fullAnswerInput });
    res.json({ success: true, message: 'Card rating saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8.5. Save Cloze test results (Keep route for compatibility)
app.post('/api/cloze/grade', authenticateToken, async (req, res) => {
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
    await saveGrade(req.user.userId, parseInt(questionId), scores, inputs, { result });
    res.json({ success: true, message: 'Cloze test result saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. Get Statistics & Weakness reports
app.get('/api/statistics', authenticateToken, async (req, res) => {
  try {
    const stats = await getStatistics(req.user.userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9.5. Get user's recitation attempts history
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT ah.*, q.question, q.subject, q.chapter, q.full_answer, q.cloze_keywords, q.cloze_answer, q.full_score_points
      FROM answers_history ah
      JOIN questions q ON ah.question_id = q.id
      WHERE ah.user_id = $1
      ORDER BY ah.created_at DESC
    `;
    const result = await query(sql, [req.user.userId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9.6. Toggle question weak status (add/remove from error reinforcement)
app.post('/api/history/toggle-weak', authenticateToken, async (req, res) => {
  try {
    const { questionId, forceWeak } = req.body;
    if (!questionId) {
      return res.status(400).json({ success: false, message: 'questionId is required' });
    }
    await toggleWeakCard(req.user.userId, parseInt(questionId), !!forceWeak);
    res.json({ success: true, message: 'Weak card status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. Admin: Import questions from Markdown / JSON
app.post('/api/questions/import', authenticateToken, async (req, res) => {
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
app.get('/api/questions/export', authenticateToken, async (req, res) => {
  try {
    const data = await getQuestions(req.user.userId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12. Admin: Clear database (for reset/re-sync)
app.post('/api/questions/clear', authenticateToken, async (req, res) => {
  try {
    await clearAllTables();
    res.json({ success: true, message: 'All database tables cleared successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. Admin: AI Import helper
app.post('/api/questions/import-ai', authenticateToken, async (req, res) => {
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
