import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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

  // 4. Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create default admin user if no users exist
  const salt = await bcrypt.genSalt(10);
  const defaultHash = await bcrypt.hash('admin123', salt);
  const userCheck = await query('SELECT id FROM users LIMIT 1');
  let defaultUserId = null;
  if (userCheck.rows.length === 0) {
    const insertRes = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      ['admin', defaultHash]
    );
    defaultUserId = insertRes.rows[0].id;
    console.log('Created default admin user with ID:', defaultUserId);
  } else {
    defaultUserId = userCheck.rows[0].id;
  }

  // 5. Create answers_history table (Redesigned for weighted scores, with user relation)
  await query(`
    CREATE TABLE IF NOT EXISTS answers_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

  // 6. Create review_states table (with user relation)
  await query(`
    CREATE TABLE IF NOT EXISTS review_states (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
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

  // Run migrations to add user_id column and drop old constraints on review_states and answers_history
  try {
    await query('ALTER TABLE review_states ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
    await query('ALTER TABLE answers_history ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
    
    // Migrate existing data to default admin user
    await query('UPDATE review_states SET user_id = $1 WHERE user_id IS NULL', [defaultUserId]);
    await query('UPDATE answers_history SET user_id = $1 WHERE user_id IS NULL', [defaultUserId]);
    
    // Set user_id as NOT NULL
    await query('ALTER TABLE review_states ALTER COLUMN user_id SET NOT NULL');
    await query('ALTER TABLE answers_history ALTER COLUMN user_id SET NOT NULL');
    
    // Drop single question_id constraint if it exists on review_states
    await query('ALTER TABLE review_states DROP CONSTRAINT IF EXISTS review_states_question_id_key');
    
    // Add composite constraint (user_id, question_id) UNIQUE
    const constraintCheck = await query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'review_states' AND constraint_name = 'uniq_user_question'
    `);
    if (constraintCheck.rows.length === 0) {
      await query('ALTER TABLE review_states ADD CONSTRAINT uniq_user_question UNIQUE (user_id, question_id)');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
  }

  // Index creation for performance
  await query(`CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_review_states_user_next ON review_states(user_id, next_review_time);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_answers_history_user_question ON answers_history(user_id, question_id);`);

  // Run migrations to add weakness_summary and question_type columns if not exists
  try {
    await query(`ALTER TABLE review_states ADD COLUMN IF NOT EXISTS weakness_summary TEXT`);
  } catch (err) {
    console.warn('Migration warning: could not add weakness_summary to review_states:', err.message);
  }
  try {
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) DEFAULT '名词解释'`);
  } catch (err) {
    console.warn('Migration warning: could not add question_type to questions:', err.message);
  }

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

    // Initialize review state for default admin user
    await query(`
      INSERT INTO review_states (user_id, question_id, mastery_level, review_count, error_count, next_review_time)
      VALUES ($1, $2, 0, 0, 0, CURRENT_TIMESTAMP)
    `, [defaultUserId, questionId]);
  }
}

// Get all questions (user-scoped progress)
export async function getQuestions(userId, filters = {}) {
  let sql = `
    SELECT q.*, 
           COALESCE(rs.mastery_level, 0) as mastery_level,
           rs.review_count,
           rs.error_count,
           rs.last_score,
           rs.next_review_time
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id AND rs.user_id = $1
    WHERE 1=1
  `;
  const params = [userId];
  let paramCount = 2;

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

// Get single question (user-scoped progress)
export async function getQuestion(id, userId) {
  const sql = `
    SELECT q.*, 
           COALESCE(rs.mastery_level, 0) as mastery_level,
           rs.review_count,
           rs.error_count,
           rs.last_score,
           rs.next_review_time
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id AND rs.user_id = $1
    WHERE q.id = $2
  `;
  const res = await query(sql, [userId, id]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    cloze_keywords: typeof row.cloze_keywords === 'string' ? JSON.parse(row.cloze_keywords) : row.cloze_keywords,
    full_score_points: typeof row.full_score_points === 'string' ? JSON.parse(row.full_score_points) : row.full_score_points
  };
}

// Helper to get question type (auxiliary display only)
export function getQuestionType(q) {
  if (q && q.question_type) return q.question_type;
  return '名词解释';
}

// Create Question
export async function createQuestion(q) {
  const { 
    question, subject, chapter, 
    cloze_answer, cloze_keywords, 
    full_answer, full_score_points, 
    difficulty, importance,
    question_type
  } = q;
  
  const derivedType = getQuestionType({ question_type });
  
  const qInsert = await query(`
    INSERT INTO questions (question, subject, chapter, cloze_answer, cloze_keywords, full_answer, full_score_points, difficulty, importance, question_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
    importance || 3,
    derivedType
  ]);

  const questionId = qInsert.rows[0].id;
  return questionId;
}

// Update Question
export async function updateQuestion(id, q) {
  const { 
    question, subject, chapter, 
    cloze_answer, cloze_keywords, 
    full_answer, full_score_points, 
    difficulty, importance,
    question_type
  } = q;
  
  const derivedType = getQuestionType({ question_type });
  
  await query(`
    UPDATE questions
    SET question = $1, subject = $2, chapter = $3, cloze_answer = $4, cloze_keywords = $5,
        full_answer = $6, full_score_points = $7, difficulty = $8, importance = $9, question_type = $10, updated_at = CURRENT_TIMESTAMP
    WHERE id = $11
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
    derivedType,
    id
  ]);
}

// Delete Question
export async function deleteQuestion(id) {
  await query('DELETE FROM questions WHERE id = $1', [id]);
}

// Get today's review queues (user-scoped)
export async function getTodayReviews(userId) {
  const sql = `
    SELECT q.*, 
           COALESCE(rs.mastery_level, 0) as mastery_level,
           rs.review_count,
           rs.error_count,
           rs.last_score,
           rs.average_score,
           rs.weakness_summary,
           rs.next_review_time
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id AND rs.user_id = $1
    ORDER BY rs.next_review_time ASC
  `;
  const res = await query(sql, [userId]);
  const now = new Date();
  
  const categories = {
    newQuestions: [],
    dueQuestions: [],
    errorReinforcement: [],
    delayedQuestions: [],
    upcomingQuestions: [],
    allReviews: []
  };

  res.rows.forEach(row => {
    const r = {
      ...row,
      question_type: row.question_type || getQuestionType(row),
      cloze_keywords: typeof row.cloze_keywords === 'string' ? JSON.parse(row.cloze_keywords) : row.cloze_keywords,
      full_score_points: typeof row.full_score_points === 'string' ? JSON.parse(row.full_score_points) : row.full_score_points
    };

    // Calculate priority values safely
    const nextReview = r.next_review_time ? new Date(r.next_review_time) : now;
    const diffTime = now.getTime() - nextReview.getTime();
    const overdueDays = diffTime > 0 ? (diffTime / (1000 * 60 * 60 * 24)) : 0;
    
    // Safety fallback value mappings
    const errorCount = parseInt(r.error_count !== null && r.error_count !== undefined ? r.error_count : 0, 10);
    const importance = parseInt(r.importance !== null && r.importance !== undefined ? r.importance : 3, 10);
    const difficulty = parseInt(r.difficulty !== null && r.difficulty !== undefined ? r.difficulty : 3, 10);
    const masteryLevel = parseInt(r.mastery_level !== null && r.mastery_level !== undefined ? r.mastery_level : 0, 10);
    const lastScore = r.last_score !== null && r.last_score !== undefined ? parseFloat(r.last_score) : null;
    const avgScore = r.average_score !== null && r.average_score !== undefined ? parseFloat(r.average_score) : 0;
    const reviewCount = parseInt(r.review_count !== null && r.review_count !== undefined ? r.review_count : 0, 10);

    // priority = min(overdueDays, 14) * 3 + errorCount * 4 + importance * 2 + difficulty * 1.5 - masteryLevel * 2
    r.priority = Math.min(overdueDays, 14) * 3 + errorCount * 4 + importance * 2 + difficulty * 1.5 - masteryLevel * 2;

    const isOverdue = nextReview <= new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const isDue = nextReview <= now;

    if (r.mastery_level === 0) {
      categories.newQuestions.push(r);
    } else {
      // 错题回炉 upgraded criteria:
      // errorCount >= 2 OR lastScore < 5 OR avgScore < 6 OR masteryLevel <= 2
      const isWeak = r.mastery_level > 0 && (
        errorCount >= 2 ||
        (lastScore !== null && lastScore < 5) ||
        (reviewCount > 0 && avgScore < 6) ||
        masteryLevel <= 2
      );

      if (isWeak) {
        categories.errorReinforcement.push(r);
      } else if (isOverdue) {
        categories.delayedQuestions.push(r);
        categories.allReviews.push(r);
      } else if (isDue) {
        categories.dueQuestions.push(r);
        categories.allReviews.push(r);
      } else {
        categories.upcomingQuestions.push(r);
      }
    }
  });

  // Sort by priority descending
  categories.delayedQuestions.sort((a, b) => b.priority - a.priority);
  categories.dueQuestions.sort((a, b) => b.priority - a.priority);
  categories.errorReinforcement.sort((a, b) => b.priority - a.priority);
  categories.upcomingQuestions.sort((a, b) => b.priority - a.priority);
  categories.allReviews.sort((a, b) => b.priority - a.priority);

  // Sort new questions by created_at descending (newest first) to prioritize today's new uploads
  categories.newQuestions.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return categories;
}

// Log answer attempt (with tri-scores) and schedule next spaced review (user-scoped)
export async function saveGrade(userId, questionId, detailScores, inputs, aiFeedback) {
  const { clozeScore, fullScore, totalScore } = detailScores;
  const { clozeAnswers, fullAnswerInput } = inputs;

  // 1. Insert history log
  await query(`
    INSERT INTO answers_history (user_id, question_id, cloze_score, full_score, total_score, cloze_answers, full_answer_input, ai_feedback)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    userId,
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
  const currentRS = await query('SELECT mastery_level, review_count, error_count, average_score FROM review_states WHERE user_id = $1 AND question_id = $2', [userId, questionId]);
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
  const missingPoints = aiFeedback?.full_evaluation?.missing_points || [];
  const weaknessSummary = Array.isArray(missingPoints) 
    ? JSON.stringify(missingPoints) 
    : JSON.stringify([]);

  await query(`
    INSERT INTO review_states (user_id, question_id, mastery_level, review_count, error_count, last_score, average_score, last_review_time, next_review_time, weakness_summary, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, question_id) DO UPDATE SET
      mastery_level = EXCLUDED.mastery_level,
      review_count = EXCLUDED.review_count,
      error_count = EXCLUDED.error_count,
      last_score = EXCLUDED.last_score,
      average_score = EXCLUDED.average_score,
      last_review_time = EXCLUDED.last_review_time,
      next_review_time = EXCLUDED.next_review_time,
      weakness_summary = EXCLUDED.weakness_summary,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, questionId, newLevel, reviewCount, errorCount, totalScore, newAvgScore, nextReviewTime, weaknessSummary]);
}

// Log card rating (忘记, 困难, 基本会, 熟练) and update schedule (user-scoped)
export async function rateCard(userId, questionId, rating, inputs = {}) {
  const { clozeAnswers = {}, fullAnswerInput = '' } = inputs;
  const intervalDays = SCHEDULER_RULES.intervalsByRating[rating] || 1;
  const now = new Date();
  const nextReviewTime = new Date();
  nextReviewTime.setDate(now.getDate() + intervalDays);

  const currentRS = await query('SELECT mastery_level, review_count, error_count FROM review_states WHERE user_id = $1 AND question_id = $2', [userId, questionId]);
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

  // Save history log with student's actual inputs
  await query(`
    INSERT INTO answers_history (user_id, question_id, total_score, cloze_answers, full_answer_input, ai_feedback)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    userId,
    questionId, 
    rating === 'easy' ? 10 : rating === 'good' ? 8 : rating === 'hard' ? 5 : 2, 
    JSON.stringify(clozeAnswers),
    fullAnswerInput || `[自评] ${rating}`, 
    JSON.stringify({ rating, comments: `卡片背诵自评结果为: ${rating}` })
  ]);

  // Upsert review state
  await query(`
    INSERT INTO review_states (user_id, question_id, mastery_level, review_count, error_count, last_score, last_review_time, next_review_time, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, question_id) DO UPDATE SET
      mastery_level = EXCLUDED.mastery_level,
      review_count = EXCLUDED.review_count,
      error_count = EXCLUDED.error_count,
      last_score = EXCLUDED.last_score,
      last_review_time = EXCLUDED.last_review_time,
      next_review_time = EXCLUDED.next_review_time,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, questionId, newLevel, reviewCount, errorCount, rating === 'easy' ? 10 : rating === 'good' ? 8 : rating === 'hard' ? 5 : 2, nextReviewTime]);
}

// Get statistics for dashboard and weaknesses analysis (user-scoped)
export async function getStatistics(userId) {
  const totalQ = await query('SELECT COUNT(*) FROM questions');
  const studiedQ = await query('SELECT COUNT(*) FROM review_states WHERE user_id = $1 AND mastery_level > 0', [userId]);
  
  // Mastery levels distribution
  const masteryDist = await query(`
    SELECT COALESCE(rs.mastery_level, 0) as level, COUNT(*) as count
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id AND rs.user_id = $1
    GROUP BY COALESCE(rs.mastery_level, 0)
    ORDER BY level ASC
  `, [userId]);

  // Completion statuses for today
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const completedToday = await query(`
    SELECT COUNT(DISTINCT question_id) 
    FROM answers_history 
    WHERE user_id = $1 AND created_at >= $2
  `, [userId, startOfDay]);

  // Average score (from total_score field)
  const avgScore = await query('SELECT AVG(total_score) as avg FROM answers_history WHERE user_id = $1 AND total_score >= 0', [userId]);

  // Total errors count
  const errorCount = await query('SELECT COUNT(*) FROM answers_history WHERE user_id = $1 AND total_score < 5', [userId]);

  // Weaknesses analysis: chapters with most errors
  const chapterWeaknesses = await query(`
    SELECT q.chapter, COUNT(*) as error_count, AVG(ah.total_score) as avg_score
    FROM answers_history ah
    JOIN questions q ON ah.question_id = q.id
    WHERE ah.user_id = $1 AND ah.total_score < 5
    GROUP BY q.chapter
    ORDER BY error_count DESC
    LIMIT 5
  `, [userId]);

  // Today's review queue
  const todayReviews = await getTodayReviews(userId);
  const activeReviews = [...todayReviews.delayedQuestions, ...todayReviews.dueQuestions];

  // Calculate highest priority chapter
  const chapterPriorities = {};
  activeReviews.forEach(r => {
    if (!chapterPriorities[r.chapter]) {
      chapterPriorities[r.chapter] = { total: 0, count: 0 };
    }
    chapterPriorities[r.chapter].total += r.priority || 0;
    chapterPriorities[r.chapter].count += 1;
  });

  let highestPriorityChapter = '无';
  let maxAvgPriority = -999;
  Object.entries(chapterPriorities).forEach(([chap, val]) => {
    const avg = val.total / val.count;
    if (avg > maxAvgPriority) {
      maxAvgPriority = avg;
      highestPriorityChapter = chap;
    }
  });

  // Top 10 hardest questions (ordered by error count desc)
  const top10HardestRes = await query(`
    SELECT q.id, q.question, rs.error_count, rs.average_score, rs.review_count
    FROM questions q
    JOIN review_states rs ON q.id = rs.question_id AND rs.user_id = $1
    WHERE rs.review_count > 0
    ORDER BY rs.error_count DESC, rs.average_score ASC
    LIMIT 10
  `, [userId]);

  // Upcoming forgotten questions (ordered by next review time asc)
  const upcomingForgottenRes = await query(`
    SELECT q.id, q.question, rs.next_review_time, rs.mastery_level
    FROM questions q
    JOIN review_states rs ON q.id = rs.question_id AND rs.user_id = $1
    WHERE rs.mastery_level > 0
    ORDER BY rs.next_review_time ASC
    LIMIT 5
  `, [userId]);

  // Daily learning activity for last 7 days
  const dailyActivity = await query(`
    SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count, AVG(total_score) as avg_score
    FROM answers_history
    WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY date ASC
  `, [userId]);

  // Mastery rate by chapter
  const chapterProgress = await query(`
    SELECT q.chapter, 
           COUNT(*) as total_count,
           COUNT(CASE WHEN rs.mastery_level >= 4 THEN 1 END) as mastered_count,
           COUNT(CASE WHEN rs.mastery_level > 0 AND rs.mastery_level < 4 THEN 1 END) as learning_count
    FROM questions q
    LEFT JOIN review_states rs ON q.id = rs.question_id AND rs.user_id = $1
    GROUP BY q.chapter
    ORDER BY total_count DESC
  `, [userId]);

  // Parse AI common mistakes from weakness_summary JSON arrays
  const weaknessRes = await query(`
    SELECT rs.weakness_summary 
    FROM review_states rs
    WHERE rs.user_id = $1 AND rs.weakness_summary IS NOT NULL AND rs.weakness_summary <> ''
  `, [userId]);
  
  const mistakeCounts = {};
  weaknessRes.rows.forEach(row => {
    try {
      const parsed = JSON.parse(row.weakness_summary);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (item) {
            mistakeCounts[item] = (mistakeCounts[item] || 0) + 1;
          }
        });
      }
    } catch (e) {
      // Fallback
    }
  });

  const aiCommonMistakes = Object.entries(mistakeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => ({ point: entry[0], count: entry[1] }));

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
    remainingReviewsToday: todayReviews.delayedQuestions.length + todayReviews.dueQuestions.length,
    averageScore: parseFloat(parseFloat(avgScore.rows[0].avg || 0).toFixed(1)),
    totalErrors: parseInt(errorCount.rows[0].count),
    levelDistribution: levelCounts,
    chapterWeaknesses: chapterWeaknesses.rows,
    hardestQuestions: top10HardestRes.rows.slice(0, 5), // Keep for legacy compatibility
    top10Hardest: top10HardestRes.rows,
    highestPriorityChapter,
    weakestChapter: chapterWeaknesses.rows.length > 0 ? chapterWeaknesses.rows[0].chapter : '无',
    upcomingForgotten: upcomingForgottenRes.rows.map(row => ({
      ...row,
      next_review_time: row.next_review_time
    })),
    last7DaysActivity: dailyActivity.rows,
    chapterProgress: chapterProgress.rows,
    aiCommonMistakes,
    delayedCount: todayReviews.delayedQuestions.length,
    errorReinforcementCount: todayReviews.errorReinforcement.length
  };
}

export async function clearAllTables() {
  await query('TRUNCATE TABLE question_tags, answers_history, review_states, questions, tags CASCADE');
}

// ==========================================================================
// User Authentication Helper Functions
// ==========================================================================

export async function createUser(username, passwordHash) {
  const res = await query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
    [username, passwordHash]
  );
  return res.rows[0];
}

export async function getUserByUsername(username) {
  const res = await query('SELECT * FROM users WHERE username = $1', [username]);
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function getUserById(id) {
  const res = await query('SELECT id, username, created_at FROM users WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function toggleWeakCard(userId, questionId, forceWeak) {
  if (forceWeak) {
    await query(`
      INSERT INTO review_states (user_id, question_id, mastery_level, error_count, next_review_time, weakness_summary, updated_at)
      VALUES ($1, $2, 1, 2, CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        mastery_level = 1,
        error_count = GREATEST(review_states.error_count, 2),
        next_review_time = CURRENT_TIMESTAMP,
        weakness_summary = $3,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, questionId, JSON.stringify(['用户手动拉入错题强化'])]);
  } else {
    await query(`
      UPDATE review_states
      SET mastery_level = 3,
          error_count = 0,
          last_score = 8,
          average_score = GREATEST(average_score, 7),
          next_review_time = CURRENT_TIMESTAMP + INTERVAL '3 days',
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND question_id = $2
    `, [userId, questionId]);
  }
}

