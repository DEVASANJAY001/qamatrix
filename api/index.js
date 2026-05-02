import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'qamatrix';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let cachedDb = null;
let cachedClient = null;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { default: fetch } = await import('node-fetch');
      const response = await fetch(url, options);
      if (response.status === 429 || response.status >= 500) {
        const waitTime = (i + 1) * 10000;
        console.warn(`Retry ${i + 1}: Received ${response.status}. Waiting ${waitTime}ms...`);
        await wait(waitTime);
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      await wait(2000 * (i + 1));
    }
  }
  throw lastError || new Error("Max retries reached");
}

async function connectDB() {
  if (cachedDb) return cachedDb;
  cachedClient = new MongoClient(uri);
  await cachedClient.connect();
  cachedDb = cachedClient.db(dbName);
  return cachedDb;
}

// AI Functions
async function getOpenRouterMatches(apiKey, model, prompt) {
  const { default: fetch } = await import('node-fetch');
  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://qamatrix.vercel.app",
      "X-Title": "QA Matrix"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: "You are an automotive quality assurance expert. You must return a JSON object with a 'matches' array. Each item in 'matches' must have: defectIndex (number), matchedSNo (number or null), confidence (number 0-1), and reason (string)." },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `OpenRouter error: ${response.status}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  return result.matches;
}

async function getOpenAIMatches(apiKey, prompt, defects, concerns) {
  const { default: fetch } = await import('node-fetch');
  const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an automotive quality assurance expert. You must return a JSON object with a 'matches' array. Each item in 'matches' must have: defectIndex (number), matchedSNo (number or null), confidence (number 0-1), and reason (string)." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  return result.matches;
}

async function getGeminiMatches(apiKey, prompt, defects, concerns) {
  const { default: fetch } = await import('node-fetch');
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{
        function_declarations: [{
          name: "submit_matches",
          description: "Submit the matching results for all defects.",
          parameters: {
            type: "OBJECT",
            properties: {
              matches: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    defectIndex: { type: "NUMBER" },
                    matchedSNo: { type: "NUMBER", nullable: true },
                    confidence: { type: "NUMBER" },
                    reason: { type: "STRING" }
                  },
                  required: ["defectIndex", "matchedSNo", "confidence", "reason"],
                }
              }
            },
            required: ["matches"],
          }
        }]
      }],
      tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["submit_matches"] } }
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    const msg = error.error?.message || `Gemini API error: ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const aiResult = await response.json();
  const candidate = aiResult.candidates?.[0];
  const toolCall = candidate?.content?.parts?.find(p => p.functionCall)?.functionCall;
  if (!toolCall || !toolCall.args) throw new Error("No structured response from Gemini API");
  return toolCall.args.matches;
}

// API Routes
app.get('/api/qa-matrix', async (req, res) => {
  try {
    const db = await connectDB();
    const entries = await db.collection('qa_matrix_entries').find({}).sort({ s_no: 1 }).limit(10000).toArray();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/qa-matrix/upsert', async (req, res) => {
  try {
    const db = await connectDB();
    const data = req.body;
    if (Array.isArray(data)) {
      for (const item of data) {
        await db.collection('qa_matrix_entries').updateOne({ s_no: item.s_no }, { $set: item }, { upsert: true });
      }
      res.json({ success: true, count: data.length });
    } else {
      const result = await db.collection('qa_matrix_entries').updateOne({ s_no: data.s_no }, { $set: data }, { upsert: true });
      res.json({ success: true, result });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/qa-matrix/:sNo', async (req, res) => {
  try {
    const db = await connectDB();
    const sNo = parseInt(req.params.sNo);
    const result = await db.collection('qa_matrix_entries').deleteOne({ s_no: sNo });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/qa-matrix', async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection('qa_matrix_entries').deleteMany({ s_no: { $ne: -9999 } });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Snapshots
app.get('/api/snapshots', async (req, res) => {
  try {
    const db = await connectDB();
    const snapshots = await db.collection('qa_matrix_snapshots').find({}, { projection: { snapshot_date: 1 } }).sort({ snapshot_date: -1 }).toArray();
    res.json(snapshots.map(s => s.snapshot_date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/snapshots/:date', async (req, res) => {
  try {
    const db = await connectDB();
    const snapshot = await db.collection('qa_matrix_snapshots').findOne({ snapshot_date: req.params.date });
    res.json(snapshot ? snapshot.data : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/snapshots', async (req, res) => {
  try {
    const db = await connectDB();
    const { snapshot_date, data } = req.body;
    const result = await db.collection('qa_matrix_snapshots').updateOne({ snapshot_date }, { $set: { snapshot_date, data, updated_at: new Date() } }, { upsert: true });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Match
app.post('/api/match-defects', async (req, res) => {
  try {
    const { defects, concerns } = req.body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const AI_MODEL = process.env.AI_MODEL || "google/gemini-3.1-flash-lite-preview";

    if (!defects?.length || !concerns?.length) return res.json({ matches: defects?.map(() => null) || [] });

    const concernsList = concerns.map(c => `[${c.sNo}] "${c.concern}" (station: ${c.operationStation}, area: ${c.designation})`).join("\n");
    const defectsList = defects.map(d => `[${d.index}] Location: "${d.locationDetails}" | Defect: "${d.defectDescription}" | Details: "${d.defectDescriptionDetails}" | Gravity: ${d.gravity}`).join("\n");
    const prompt = `You are an automotive quality assurance expert. Match defect reports to known QA concerns.\n\nQA Matrix:\n${concernsList}\n\nDefects:\n${defectsList}\n\nFor each defect, find the best matching QA concern. Return JSON with 'matches' array.`;

    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim().length > 10) {
      console.log(`AI Match: Using OpenRouter (${AI_MODEL})`);
      const matches = await getOpenRouterMatches(OPENROUTER_API_KEY, AI_MODEL, prompt);
      return res.json({ matches });
    }

    if (GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 10) {
      const matches = await getGeminiMatches(GEMINI_API_KEY, prompt, defects, concerns);
      return res.json({ matches });
    }

    if (OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 10) {
      const matches = await getOpenAIMatches(OPENAI_API_KEY, prompt, defects, concerns);
      return res.json({ matches });
    }

    res.status(500).json({ error: "AI API keys not configured" });
  } catch (err) {
    console.error("AI matching error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Defect Data
app.get('/api/defect-data', async (req, res) => {
  try {
    const db = await connectDB();
    const data = await db.collection('defect_data').find().sort({ uploaded_at: -1 }).limit(10000).toArray();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/defect-data', async (req, res) => {
  try {
    const db = await connectDB();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const rowsWithDate = rows.map(r => ({ ...r, uploaded_at: r.uploaded_at || new Date().toISOString() }));
    await db.collection('defect_data').insertMany(rowsWithDate);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/defect-data', async (req, res) => {
  try {
    const db = await connectDB();
    const { source } = req.query;
    const filter = source ? { source } : {};
    await db.collection('defect_data').deleteMany(filter);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Final Defect
app.post('/api/final-defect', async (req, res) => {
  try {
    const db = await connectDB();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const rowsWithDate = rows.map(r => ({ ...r, created_at: r.created_at || new Date().toISOString() }));
    await db.collection('final_defect').insertMany(rowsWithDate);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pair by Semantic
app.post('/api/pair-by-semantic', async (req, res) => {
  try {
    const db = await connectDB();
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const concerns = await db.collection('qa_matrix_entries').find({}).toArray();
    const defects = await db.collection('dvx_defects').find({ pairing_status: { $ne: 'paired' } }).toArray();

    if (defects.length === 0) return res.json({ paired: 0, unpaired: 0, message: "No unpaired defects found." });

    const concernsList = concerns.map(c => `[${c.s_no}] "${c.concern}"`).join("\n");
    let pairedCount = 0;
    let batchSize = 10;

    for (let i = 0; i < defects.length; i += batchSize) {
      if (i > 0) await wait(5000);
      const batch = defects.slice(i, i + batchSize);
      const defectsList = batch.map((d, idx) => `[${idx}] Defect: "${d.defect_description_details || d.defect_description || "Unknown Defect"}"`).join("\n");
      const prompt = `Match these defects to QA concerns:\nQA:\n${concernsList}\n\nDefects:\n${defectsList}\n\nReturn JSON with 'matches' array. Each match: { defectIndex, matchedSNo, confidence, reason }`;

      try {
        let matches;
        if (GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 10) {
          matches = await getGeminiMatches(GEMINI_API_KEY, prompt, batch.map((_, idx) => ({ index: idx })), concerns.map(c => ({ sNo: c.s_no, concern: c.concern })));
        } else if (OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 10) {
          matches = await getOpenAIMatches(OPENAI_API_KEY, prompt, batch, concerns);
        } else {
          throw new Error("No AI API keys configured");
        }

        const updatePromises = matches.map(async (match) => {
          const defect = batch[match.defectIndex];
          if (defect && match.matchedSNo && match.confidence >= 0.6) {
            pairedCount++;
            return db.collection('dvx_defects').updateOne(
              { _id: defect._id },
              { $set: { pairing_status: 'paired', pairing_method: 'semantic_ai', match_score: match.confidence, qa_matrix_sno: match.matchedSNo, pairing_reason: match.reason } }
            );
          }
          return null;
        });
        await Promise.all(updatePromises.filter(p => p !== null));
      } catch (e) { console.error("Batch error:", e); }
    }
    res.json({ paired: pairedCount, unpaired: defects.length - pairedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default app;
