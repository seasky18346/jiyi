import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve paths
const MD_FILE_PATH = path.resolve('D:/考研/专业课每日背诵/近期专业课每日背诵汇总.md');
const PROGRESS_FILE_PATH = path.resolve('D:/考研/专业课每日背诵/recitation_progress.json');

app.use(cors());
app.use(express.json());

// Helper: Backup file before write
function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const backupPath = path.join(dir, `${base}.bak${ext}`);
    fs.copyFileSync(filePath, backupPath);
  }
}

// Markdown parsing engine
function parseMarkdown(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const result = [];
  
  let currentGroup = null;
  let currentItem = null;
  let globalItemIndex = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Parse Date Group: e.g. ## 📅 6月12日背诵内容：地理信息系统基础理论
    if (line.startsWith('## ')) {
      const title = line.replace(/^##\s*(📅)?\s*/, '').trim();
      currentGroup = {
        date: title,
        items: []
      };
      result.push(currentGroup);
      currentItem = null;
      continue;
    }
    
    // Parse Item: e.g. ### 1. 地理数据和地理信息
    if (line.startsWith('### ')) {
      const rawTitle = line.replace('### ', '').trim();
      const match = rawTitle.match(/^(\d+)\.\s*(.*)/);
      const id = match ? parseInt(match[1]) : globalItemIndex;
      const title = match ? match[2] : rawTitle;
      
      currentItem = {
        id: id,
        title: title,
        rawContent: [],
        points: []
      };
      
      globalItemIndex = id + 1;
      
      if (currentGroup) {
        currentGroup.items.push(currentItem);
      } else {
        currentGroup = { date: "未分类", items: [currentItem] };
        result.push(currentGroup);
      }
      continue;
    }
    
    // Parse bullet points inside an item
    if (currentItem && line !== '') {
      currentItem.rawContent.push(line);
      
      // Match bullet point formats: e.g. * **term**：definition or 1. **term**：definition
      const listItemMatch = line.match(/^([*\-+]$|^\*|^\d+\.)\s+(.*)/);
      if (listItemMatch) {
        const itemContent = listItemMatch[2].trim();
        
        // Match: **term**: definition OR *term* classification: definition
        const termMatch = itemContent.match(/^(?:\*\*|\*)(.*?)(?:\*\*|\*)\s*(.*?)\s*[：:]\s*(.*)/);
        
        if (termMatch) {
          const mainTerm = termMatch[1].trim();
          const subTerm = termMatch[2].trim();
          const concept = subTerm ? `${mainTerm} (${subTerm})` : mainTerm;
          const description = termMatch[3].trim();
          
          // Extract keywords (all bold texts in the description)
          const keywords = [];
          const regex = /\*\*(.*?)\*\*/g;
          let kwMatch;
          while ((kwMatch = regex.exec(description)) !== null) {
            const kw = kwMatch[1].trim();
            if (kw && !keywords.includes(kw)) {
              keywords.push(kw);
            }
          }
          
          currentItem.points.push({
            id: `${currentItem.id}_${currentItem.points.length + 1}`,
            concept: concept,
            description: description,
            keywords: keywords,
            rawLine: line
          });
        } else {
          // General list item
          const keywords = [];
          const regex = /\*\*(.*?)\*\*/g;
          let kwMatch;
          while ((kwMatch = regex.exec(itemContent)) !== null) {
            const kw = kwMatch[1].trim();
            if (kw && !keywords.includes(kw)) {
              keywords.push(kw);
            }
          }
          
          currentItem.points.push({
            id: `${currentItem.id}_${currentItem.points.length + 1}`,
            concept: currentItem.title,
            description: itemContent,
            keywords: keywords,
            rawLine: line
          });
        }
      }
    }
  }
  
  // Post-process rawContent
  result.forEach(group => {
    group.items.forEach(item => {
      item.rawContent = item.rawContent.join('\n');
    });
  });
  
  return result;
}

// Write back structured changes to Markdown file
function writeMarkdown(filePath, parsedData) {
  let mdContent = '';
  
  // Add Header (mimicking the original header)
  mdContent += `# 806 测绘地理信息学基础 - 近期每日背诵内容汇总 (6.12 - 6.15)\n\n`;
  mdContent += `本文是根据您 \`D:\\考研\\专业课每日背诵\` 目录下的每日背诵文件（\`0612.docx\`、\`0614(1).docx\`、\`0615.docx\`）进行精炼整合，并在涉及测绘基础概念（大地水准面、参考椭球、旋转轴定位及四大坐标系）时，融入了您 \`806测绘地理信息学\` 和 \`测量学\` 专业课资料中的高分、标准定义，对核心词进行了加粗。\n\n`;
  
  parsedData.forEach(group => {
    mdContent += `---\n\n`;
    mdContent += `## 📅 ${group.date}\n\n`;
    
    group.items.forEach(item => {
      mdContent += `### ${item.id}. ${item.title}\n`;
      
      if (item.points && item.points.length > 0) {
        item.points.forEach((point, pIdx) => {
          let linePrefix = '*   ';
          if (point.rawLine && /^\d+\./.test(point.rawLine.trim())) {
            const matchNum = point.rawLine.trim().match(/^(\d+\.)/);
            linePrefix = `${matchNum[1]}  `;
          }
          
          let conceptToWrite = point.concept;
          mdContent += `${linePrefix}**${conceptToWrite}**：${point.description}\n`;
        });
      } else {
        mdContent += `${item.rawContent}\n`;
      }
      mdContent += `\n`;
    });
  });
  
  backupFile(filePath);
  fs.writeFileSync(filePath, mdContent, 'utf-8');
}

// API: Get structured recitation data
app.get('/api/recitation', (req, res) => {
  try {
    const data = parseMarkdown(MD_FILE_PATH);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Save/update a specific recitation item or the whole markdown
app.post('/api/recitation/update', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ success: false, message: 'Invalid data format' });
    }
    writeMarkdown(MD_FILE_PATH, data);
    res.json({ success: true, message: 'Markdown file updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Get user progress
app.get('/api/progress', (req, res) => {
  try {
    if (fs.existsSync(PROGRESS_FILE_PATH)) {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE_PATH, 'utf-8'));
      res.json({ success: true, data: progress });
    } else {
      res.json({ success: true, data: { cardStatus: {}, history: [] } });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: Save user progress
app.post('/api/progress', (req, res) => {
  try {
    const progress = req.body;
    fs.writeFileSync(PROGRESS_FILE_PATH, JSON.stringify(progress, null, 2), 'utf-8');
    res.json({ success: true, message: 'Progress saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API: AI proxy to avoid CORS
app.post('/api/ai/grade', async (req, res) => {
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

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Host front-end build files (in production)
app.use(express.static(path.join(__dirname, 'dist')));
app.get(/.*/, (req, res) => {
  const indexHtml = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send('Frontend build not found. Running in dev-only backend mode.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
