import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'recitation',
      port: parseInt(process.env.PGPORT || '5432'),
      ssl: false
    });

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Spaced repetition interval configuration based on total weighted score
const SCHEDULER_RULES = {
  intervalsByScore: (score) => {
    if (score < 5) return 1;       // under 5: review tomorrow (level drops)
    if (score <= 7) return 3;      // 5-7: review in 3 days
    if (score <= 9) return 7;      // 8-9: review in 7 days
    return 15;                     // 10: review in 15 days
  },
  intervalsByRating: {
    'forgot': 1,
    'hard': 2,
    'good': 5,
    'easy': 12
  }
};

// Initialize database schema (Redesigned for bi-answer weighted model)
export async function initDb() {
  console.log('Initializing PostgreSQL Database (Weighted Bi-Test Schema)...');

  // Automated rebuild check: if questions table has short_answer column, drop all tables to start clean
  try {
    const colCheck = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'questions' AND column_name = 'short_answer'
    `);
    if (colCheck.rows.length > 0) {
      console.log('Detected old columns (short_answer) in questions table. Rebuilding database schema...');
      await query('DROP TABLE IF EXISTS question_tags, answers_history, review_states, questions, tags CASCADE');
    }
  } catch (err) {
    console.warn('Database column check failed or table not created yet:', err.message);
  }
  
  // 1. Create tags table
  await query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      type VARCHAR(50) DEFAULT 'general'
    );
  `);

  // 2. Create questions table (Redesigned)
  await query(`
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      subject VARCHAR(255) DEFAULT '专业课',
      chapter VARCHAR(255) DEFAULT '未分类',
      cloze_answer TEXT NOT NULL,                -- 填空题标准答案
      cloze_keywords JSONB DEFAULT '[]'::jsonb,  -- 填空题需填入的关键词列表
      full_answer TEXT NOT NULL,                 -- 论述题标准答案
      full_score_points JSONB DEFAULT '[]'::jsonb,  -- 论述题全部细节得分点
      difficulty INTEGER DEFAULT 3,
      importance INTEGER DEFAULT 3,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Create question_tags mapping table
  await query(`
    CREATE TABLE IF NOT EXISTS question_tags (
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (question_id, tag_id)
    );
  `);

  // 4. Create answers_history table (Redesigned for weighted scores)
  await query(`
    CREATE TABLE IF NOT EXISTS answers_history (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      cloze_score NUMERIC,
      full_score NUMERIC,
      total_score NUMERIC NOT NULL,
      cloze_answers JSONB,
      full_answer_input TEXT,
      ai_feedback JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Create review_states table
  await query(`
    CREATE TABLE IF NOT EXISTS review_states (
      id SERIAL PRIMARY KEY,
      question_id INTEGER UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
      mastery_level INTEGER DEFAULT 0, -- 0:未学, 1:完全不会, 2:模糊, 3:基本会, 4:熟练, 5:长期掌握
      review_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      last_score NUMERIC,
      average_score NUMERIC DEFAULT 0,
      last_review_time TIMESTAMP WITH TIME ZONE,
      next_review_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Index creation for performance
  await query(`CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_review_states_next_review ON review_states(next_review_time);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_answers_history_question ON answers_history(question_id);`);

  // Check if seeding is needed
  const qCount = await query('SELECT COUNT(*) FROM questions');
  if (parseInt(qCount.rows[0].count) === 0) {
    console.log('Database is empty. Seeding default data...');
    await seedDefaultData();
  } else {
    console.log('Database already initialized with data.');
  }
}

// Seed default mock data
async function seedDefaultData() {
  const defaultData = [
    {
      question: "地理数据 (Geographic Data)",
      subject: "地理信息系统",
      chapter: "第一章 地理信息系统基础理论",
      cloze_answer: "关于地理实体性质、特征和运动状态的**原始描述**或**事实记录**。特点是**原始性、未加工**。",
      cloze_keywords: ["原始描述", "事实记录", "原始性、未加工"],
      
      full_answer: "关于地理实体性质、特征和运动状态的原始描述或事实记录。特点是原始性、未加工。地理数据不仅包含了空间位置特征，还包括了属性特征、时间特征等描述性信息，是地理学和GIS处理与分析的最基础对象。",
      full_score_points: [
        "对地理实体性质特征的描述",
        "原始描述与事实记录",
        "具有原始性和未加工的特点",
        "包含空间位置、属性和时间等特征描述"
      ],
      difficulty: 2,
      importance: 5
    },
    {
      question: "简述地理信息系统的基本构成",
      subject: "地理信息系统",
      chapter: "第一章 地理信息系统基础理论",
      cloze_answer: "地理信息系统（GIS）主要由**硬件系统**、**软件系统**、**地理数据**、**系统人员**和**方法与模型**五个核心部分构成。",
      cloze_keywords: ["硬件系统", "软件系统", "地理数据", "系统人员", "方法与模型"],
      
      full_answer: "地理信息系统（GIS）主要由以下五个核心部分构成：\n1. 硬件系统：包括计算机主机、网络设备、数字化仪、扫描仪、绘图仪等物理基础；\n2. 软件系统：提供数据输入、存储、管理、空间分析和制图输出等核心软件工具；\n3. 地理数据：系统分析和处理的核心对象，包含空间几何数据和属性描述数据，是系统建库的灵魂；\n4. 系统人员：包括系统开发人员、管理决策人员以及最终用户，是决定GIS成败的关键；\n5. 方法与模型：科学的数据组织、空间分析流程和规程模型，是系统解决复杂空间决策的重要途径。",
      full_score_points: [
        "硬件系统（物理主机与外设）",
        "软件系统（数据库、GIS分析软件）",
        "地理数据（几何与属性数据）",
        "系统人员（开发、管理与最终用户）",
        "方法与模型（应用分析规程与决策模型）"
      ],
      difficulty: 3,
      importance: 5
    }
  ];

  for (const q of defaultData) {
    const qInsert = await query(`
      INSERT INTO questions (question, subject, chapter, cloze_answer, cloze_keywords, full_answer, full_score_points, difficulty, importance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      q.question,
      q.subject,
      q.chapter,
      q.cloze_answer,
      JSON.stringify(q.cloze_keywords),
      q.full_answer,
      JSON.stringify(q.full_score_points),
      q.difficulty,
      q.importance
    ]);

    const questionId = qInsert.rows[0].id;

    // Insert tag for chapter
    const tagInsert = await query(`
      INSERT INTO tags (name, type)
      VALUES ($1, 'knowledge_point')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [q.chapter]);
    const tagId = tagInsert.rows[0].id;

    await query(`
      INSERT INTO question_tags (question_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [questionId, tagId]);

    // Initialize review state
    await query(`
      INSERT INTO review_states (question_id, mastery_level, review_count, error_count, next_review_time)
      VALUES ($1, 0, 0, 0, CURRENT_TIMESTAMP)
    `, [questionId]);
  }
}

// Get all questions
export async function getQuestions(filters = {}) {
  let sql = `
    SELECT q.*, 
           COALESCE(rs.mastery_level, 0) as mastery_level,
           rs.review_count,
           rs.error_count,
           rs.last_score,
           rs.next_review_time
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (filters.subject) {
    sql += ` AND q.subject = $${paramCount}`;
    params.push(filters.subject);
    paramCount++;
  }

  if (filters.chapter) {
    sql += ` AND q.chapter = $${paramCount}`;
    params.push(filters.chapter);
    paramCount++;
  }

  if (filters.search) {
    sql += ` AND q.question ILIKE $${paramCount}`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  sql += ` ORDER BY q.id DESC`;
  const res = await query(sql, params);
  
  return res.rows.map(row => ({
    ...row,
    cloze_keywords: typeof row.cloze_keywords === 'string' ? JSON.parse(row.cloze_keywords) : row.cloze_keywords,
    full_score_points: typeof row.full_score_points === 'string' ? JSON.parse(row.full_score_points) : row.full_score_points
  }));
}

// Get single question
export async function getQuestion(id) {
  const sql = `
    SELECT q.*, 
           COALESCE(rs.mastery_level, 0) as mastery_level,
           rs.review_count,
           rs.error_count,
           rs.last_score,
           rs.next_review_time
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id
    WHERE q.id = $1
  `;
  const res = await query(sql, [id]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    cloze_keywords: typeof row.cloze_keywords === 'string' ? JSON.parse(row.cloze_keywords) : row.cloze_keywords,
    full_score_points: typeof row.full_score_points === 'string' ? JSON.parse(row.full_score_points) : row.full_score_points
  };
}

// Create Question
export async function createQuestion(q) {
  const { 
    question, subject, chapter, 
    cloze_answer, cloze_keywords, 
    
    full_answer, full_score_points, 
    difficulty, importance 
  } = q;
  
  const qInsert = await query(`
    INSERT INTO questions (question, subject, chapter, cloze_answer, cloze_keywords, full_answer, full_score_points, difficulty, importance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    question,
    subject || '专业课',
    chapter || '未分类',
    cloze_answer,
    JSON.stringify(cloze_keywords || []),
    full_answer,
    JSON.stringify(full_score_points || []),
    difficulty || 3,
    importance || 3
  ]);

  const questionId = qInsert.rows[0].id;

  // Insert tag
  const tagInsert = await query(`
    INSERT INTO tags (name, type)
    VALUES ($1, 'knowledge_point')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [chapter || '未分类']);
  const tagId = tagInsert.rows[0].id;

  await query(`
    INSERT INTO question_tags (question_id, tag_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [questionId, tagId]);

  // Initialize review state
  await query(`
    INSERT INTO review_states (question_id, mastery_level, review_count, error_count, next_review_time)
    VALUES ($1, 0, 0, 0, CURRENT_TIMESTAMP)
  `, [questionId]);

  return questionId;
}

// Update Question
export async function updateQuestion(id, q) {
  const { 
    question, subject, chapter, 
    cloze_answer, cloze_keywords, 
    
    full_answer, full_score_points, 
    difficulty, importance 
  } = q;
  
  await query(`
    UPDATE questions
    SET question = $1, subject = $2, chapter = $3, cloze_answer = $4, cloze_keywords = $5,
        full_answer = $6, full_score_points = $7, difficulty = $8, importance = $9, updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
  `, [
    question,
    subject,
    chapter,
    cloze_answer,
    JSON.stringify(cloze_keywords || []),
    full_answer,
    JSON.stringify(full_score_points || []),
    difficulty,
    importance,
    id
  ]);

  // Sync tags
  await query('DELETE FROM question_tags WHERE question_id = $1', [id]);
  const tagInsert = await query(`
    INSERT INTO tags (name, type)
    VALUES ($1, 'knowledge_point')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [chapter || '未分类']);
  const tagId = tagInsert.rows[0].id;

  await query(`
    INSERT INTO question_tags (question_id, tag_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [id, tagId]);
}

// Delete Question
export async function deleteQuestion(id) {
  await query('DELETE FROM questions WHERE id = $1', [id]);
}

// Get today's review queues
export async function getTodayReviews() {
  const sql = `
    SELECT q.*, 
           COALESCE(rs.mastery_level, 0) as mastery_level,
           rs.review_count,
           rs.error_count,
           rs.last_score,
           rs.next_review_time
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id
    ORDER BY rs.next_review_time ASC
  `;
  const res = await query(sql);
  const now = new Date();
  
  const categories = {
    newQuestions: [],
    dueQuestions: [],
    errorReinforcement: [],
    delayedQuestions: [],
    allReviews: []
  };

  res.rows.forEach(row => {
    const r = {
      ...row,
      cloze_keywords: typeof row.cloze_keywords === 'string' ? JSON.parse(row.cloze_keywords) : row.cloze_keywords,
      full_score_points: typeof row.full_score_points === 'string' ? JSON.parse(row.full_score_points) : row.full_score_points
    };

    const nextReview = r.next_review_time ? new Date(r.next_review_time) : now;
    const isOverdue = nextReview <= new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const isDue = nextReview <= now;

    if (r.mastery_level === 0) {
      categories.newQuestions.push(r);
    } else if (isOverdue) {
      categories.delayedQuestions.push(r);
      categories.allReviews.push(r);
    } else if (isDue) {
      categories.dueQuestions.push(r);
      categories.allReviews.push(r);
    }

    if (r.mastery_level > 0 && (r.error_count > 2 || (r.last_score !== null && r.last_score < 5))) {
      categories.errorReinforcement.push(r);
    }
  });

  categories.errorReinforcement.sort((a, b) => b.error_count - a.error_count);

  return categories;
}

// Log answer attempt (with tri-scores) and schedule next spaced review
export async function saveGrade(questionId, detailScores, inputs, aiFeedback) {
  const { clozeScore, fullScore, totalScore } = detailScores;
  const { clozeAnswers, fullAnswerInput } = inputs;

  // 1. Insert history log
  await query(`
    INSERT INTO answers_history (question_id, cloze_score, full_score, total_score, cloze_answers, full_answer_input, ai_feedback)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    questionId, 
    clozeScore, 
    fullScore, 
    totalScore, 
    JSON.stringify(clozeAnswers || {}), 
    fullAnswerInput, 
    JSON.stringify(aiFeedback)
  ]);

  // 2. Calculate next review details based on total score
  const intervalDays = SCHEDULER_RULES.intervalsByScore(totalScore);
  const now = new Date();
  const nextReviewTime = new Date();
  nextReviewTime.setDate(now.getDate() + intervalDays);

  // Determine mastery level adjustment
  const currentRS = await query('SELECT mastery_level, review_count, error_count, average_score FROM review_states WHERE question_id = $1', [questionId]);
  let currentLevel = 0;
  let reviewCount = 0;
  let errorCount = 0;
  let avgScore = 0;

  if (currentRS.rows.length > 0) {
    currentLevel = currentRS.rows[0].mastery_level;
    reviewCount = currentRS.rows[0].review_count;
    errorCount = currentRS.rows[0].error_count;
    avgScore = parseFloat(currentRS.rows[0].average_score || 0);
  }

  // Adjust mastery level based on totalScore
  let newLevel = currentLevel;
  if (totalScore < 5) {
    newLevel = Math.max(1, currentLevel - 1); // Decrease but min 1
    errorCount++;
  } else if (totalScore >= 8) {
    newLevel = Math.min(5, currentLevel + 1); // Increase, max 5
  }

  reviewCount++;
  const newAvgScore = ((avgScore * (reviewCount - 1)) + totalScore) / reviewCount;

  // 3. Upsert review state
  await query(`
    INSERT INTO review_states (question_id, mastery_level, review_count, error_count, last_score, average_score, last_review_time, next_review_time, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (question_id) DO UPDATE SET
      mastery_level = EXCLUDED.mastery_level,
      review_count = EXCLUDED.review_count,
      error_count = EXCLUDED.error_count,
      last_score = EXCLUDED.last_score,
      average_score = EXCLUDED.average_score,
      last_review_time = EXCLUDED.last_review_time,
      next_review_time = EXCLUDED.next_review_time,
      updated_at = CURRENT_TIMESTAMP
  `, [questionId, newLevel, reviewCount, errorCount, totalScore, newAvgScore, nextReviewTime]);
}

// Log card rating (忘记, 困难, 基本会, 熟练) and update schedule
export async function rateCard(questionId, rating) {
  const intervalDays = SCHEDULER_RULES.intervalsByRating[rating] || 1;
  const now = new Date();
  const nextReviewTime = new Date();
  nextReviewTime.setDate(now.getDate() + intervalDays);

  const currentRS = await query('SELECT mastery_level, review_count, error_count FROM review_states WHERE question_id = $1', [questionId]);
  let currentLevel = 0;
  let reviewCount = 0;
  let errorCount = 0;

  if (currentRS.rows.length > 0) {
    currentLevel = currentRS.rows[0].mastery_level;
    reviewCount = currentRS.rows[0].review_count;
    errorCount = currentRS.rows[0].error_count;
  }

  let newLevel = currentLevel;
  if (rating === 'forgot') {
    newLevel = 1;
    errorCount++;
  } else if (rating === 'hard') {
    newLevel = Math.max(1, currentLevel - 1);
  } else if (rating === 'good') {
    newLevel = Math.min(4, Math.max(3, currentLevel + 1));
  } else if (rating === 'easy') {
    newLevel = Math.min(5, Math.max(4, currentLevel + 2));
  }

  reviewCount++;

  // Save history log
  await query(`
    INSERT INTO answers_history (question_id, total_score, full_answer_input, ai_feedback)
    VALUES ($1, $2, $3, $4)
  `, [
    questionId, 
    rating === 'easy' ? 10 : rating === 'good' ? 8 : rating === 'hard' ? 5 : 2, 
    `[卡片自评] ${rating}`, 
    JSON.stringify({ rating, comments: `卡片背诵自评结果为: ${rating}` })
  ]);

  // Upsert review state
  await query(`
    INSERT INTO review_states (question_id, mastery_level, review_count, error_count, last_score, last_review_time, next_review_time, updated_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (question_id) DO UPDATE SET
      mastery_level = EXCLUDED.mastery_level,
      review_count = EXCLUDED.review_count,
      error_count = EXCLUDED.error_count,
      last_score = EXCLUDED.last_score,
      last_review_time = EXCLUDED.last_review_time,
      next_review_time = EXCLUDED.next_review_time,
      updated_at = CURRENT_TIMESTAMP
  `, [questionId, newLevel, reviewCount, errorCount, rating === 'easy' ? 10 : rating === 'good' ? 8 : rating === 'hard' ? 5 : 2, nextReviewTime]);
}

// Get statistics for dashboard and weaknesses analysis
export async function getStatistics() {
  const totalQ = await query('SELECT COUNT(*) FROM questions');
  const studiedQ = await query('SELECT COUNT(*) FROM review_states WHERE mastery_level > 0');
  
  // Mastery levels distribution
  const masteryDist = await query(`
    SELECT COALESCE(rs.mastery_level, 0) as level, COUNT(*) as count
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id
    GROUP BY COALESCE(rs.mastery_level, 0)
    ORDER BY level ASC
  `);

  // Completion statuses for today
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const completedToday = await query(`
    SELECT COUNT(DISTINCT question_id) 
    FROM answers_history 
    WHERE created_at >= $1
  `, [startOfDay]);

  // Remaining due review count for today
  const remainingDue = await query(`
    SELECT COUNT(*) 
    FROM review_states 
    WHERE next_review_time <= CURRENT_TIMESTAMP
  `);

  // Average score (from total_score field)
  const avgScore = await query('SELECT AVG(total_score) as avg FROM answers_history WHERE total_score >= 0');

  // Total errors count
  const errorCount = await query('SELECT COUNT(*) FROM answers_history WHERE total_score < 5');

  // Weaknesses analysis: chapters with most errors
  const chapterWeaknesses = await query(`
    SELECT q.chapter, COUNT(*) as error_count, AVG(ah.total_score) as avg_score
    FROM answers_history ah
    JOIN questions q ON ah.question_id = q.id
    WHERE ah.total_score < 5
    GROUP BY q.chapter
    ORDER BY error_count DESC
    LIMIT 5
  `);

  // Top 5 hardest questions (with lowest average scores and review_count > 0)
  const hardestQuestions = await query(`
    SELECT q.id, q.question, rs.error_count, rs.average_score, rs.review_count
    FROM questions q
    JOIN review_states rs ON q.id = rs.question_id
    WHERE rs.review_count > 0
    ORDER BY rs.average_score ASC, rs.error_count DESC
    LIMIT 5
  `);

  // Daily learning activity for last 7 days
  const dailyActivity = await query(`
    SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count, AVG(total_score) as avg_score
    FROM answers_history
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY date ASC
  `);

  // Mastery rate by chapter
  const chapterProgress = await query(`
    SELECT q.chapter, 
           COUNT(*) as total_count,
           COUNT(CASE WHEN rs.mastery_level >= 4 THEN 1 END) as mastered_count,
           COUNT(CASE WHEN rs.mastery_level > 0 AND rs.mastery_level < 4 THEN 1 END) as learning_count
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id
    GROUP BY q.chapter
    ORDER BY total_count DESC
  `);

  // Map levels
  const levelCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  masteryDist.rows.forEach(row => {
    levelCounts[row.level] = parseInt(row.count);
  });

  return {
    totalQuestions: parseInt(totalQ.rows[0].count),
    learnedQuestions: parseInt(studiedQ.rows[0].count),
    unlearnedQuestions: parseInt(totalQ.rows[0].count) - parseInt(studiedQ.rows[0].count),
    completedToday: parseInt(completedToday.rows[0].count),
    remainingReviewsToday: parseInt(remainingDue.rows[0].count),
    averageScore: parseFloat(parseFloat(avgScore.rows[0].avg || 0).toFixed(1)),
    totalErrors: parseInt(errorCount.rows[0].count),
    levelDistribution: levelCounts,
    chapterWeaknesses: chapterWeaknesses.rows,
    hardestQuestions: hardestQuestions.rows,
    last7DaysActivity: dailyActivity.rows,
    chapterProgress: chapterProgress.rows
  };
}

export async function clearAllTables() {
  await query('TRUNCATE TABLE question_tags, answers_history, review_states, questions, tags CASCADE');
}
