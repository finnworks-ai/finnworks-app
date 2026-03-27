/**
 * Fix Guide Generator — expands audit action plan into detailed step-by-step fix instructions.
 * Called after a successful $97 Stripe payment.
 *
 * Takes the auditResult from generateFullReport and produces an expanded fix guide
 * with numbered steps and code snippets for each priority fix.
 */

'use strict';

const OpenAI = require('openai');

let client;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You are a senior web developer writing a step-by-step fix guide for a small business website.
The owner will hand this guide to their web developer (or follow it themselves in WordPress/Squarespace/Wix).
Write numbered steps. Be specific: name exact menu paths, HTML tags, and CSS properties.
Include code snippets where they save time. Keep each step short and actionable.
Always respond with valid JSON only. No markdown outside the JSON.`;

/**
 * Takes the top 6 priority fixes from actionPlan and expands each into detailed steps.
 */
async function generateFixGuide(url, auditResult) {
  const openai = getClient();
  const fixes = auditResult.actionPlan.fixes.slice(0, 6);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Create a detailed fix guide for this website: ${url}

Here are the 6 priority fixes to expand (in order of priority):
${fixes.map((f, i) => `${i + 1}. ${f.title} — ${f.description} (Effort: ${f.effort}, Impact: ${f.impact})`).join('\n')}

For EACH fix, provide:
- A clear summary (1 sentence) of what this fixes and why it matters
- 3-5 numbered steps to implement the fix
- A code snippet if the fix involves HTML/CSS/JS (optional — only include if it saves time)
- A "pro tip" (1 sentence of practical advice)

Return a JSON object in this exact format:
{
  "fixes": [
    {
      "priority": 1,
      "title": "<same title as input>",
      "effort": "<Low|Medium|High>",
      "impact": "<Low|Medium|High>",
      "summary": "<1 sentence: what it fixes and why it matters>",
      "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
      "code": "<optional code snippet as a plain string, or null if not applicable>",
      "codeLang": "<html|css|js|null>",
      "proTip": "<1 sentence of practical advice>"
    }
  ]
}

Important:
- steps should be concrete and specific (e.g. "In WordPress, go to Appearance > Customize > Site Identity > Site Title")
- code should be copy-paste ready, not pseudo-code
- Keep language simple — assume the reader is non-technical
- Return exactly 6 fixes`,
      },
    ],
    max_tokens: 4000,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.choices[0].message.content.trim());
  } catch (e) {
    // Fallback: return basic expansion of the original fixes
    parsed = {
      fixes: fixes.map((f, i) => ({
        priority: i + 1,
        title: f.title,
        effort: f.effort,
        impact: f.impact,
        summary: f.description,
        steps: ['Review the issue with your web developer.', 'Implement the recommended change.', 'Verify the fix with Google PageSpeed Insights.'],
        code: null,
        codeLang: null,
        proTip: 'Test on mobile after implementing any change.',
      })),
    };
  }

  return {
    url,
    generatedAt: new Date().toISOString(),
    overallScore: auditResult.overallScore,
    fixes: parsed.fixes || [],
  };
}

module.exports = { generateFixGuide };
