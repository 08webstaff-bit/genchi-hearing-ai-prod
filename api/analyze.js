// Vercel サーバーレス関数（Node.js）
// スマホからの入力＋写真を受け取り、Claude API に渡して
//   ・担当者向けの提案コメント（自然文）
//   ・写真から読み取ったAI所見（地面/傾斜/取付先/搬入経路 など）
// を返す。APIキーはこのサーバー側だけで扱う（ブラウザには出さない）。

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // 環境変数 ANTHROPIC_API_KEY を自動で読む

const SYSTEM = `あなたは膜構造物専門メーカー「丸八テント商会」の現地調査アシスタントAIです。
現場担当者がスマホで入力した条件と、社内ルールエンジンが算出した一次提案、そして現場写真を受け取ります。
あなたの役割は次の2つです。
1) comment：現場担当者に向けた提案コメントを、自然な日本語で2〜4文。ルールエンジンの提案（推奨テント種類・スペック・補強・注意点）を否定せず、要点と次にやるべきことを分かりやすくまとめる。専門的すぎず、現場で読める文体。
2) photoFindings：添付写真から読み取れる事実と示唆を箇条書きで返す。着目点は「地面の種類・状態」「傾斜の有無」「取付先の壁/柱の下地」「搬入経路の広さ・障害物」「隣接物や越境リスク」「安全上の懸念」。写真から確実に言えることを中心に、推測は控えめに。写真が無ければ空配列。
各 finding には level を付ける（ok=良好/確認済, warn=要注意, alert=要対応）。
重要：寸法・荷重・建築確認申請の最終判断は構造設計・自治体確認で確定する一次提案であることを踏まえ、断定しすぎない。`;

const SCHEMA = {
  type: 'object',
  properties: {
    comment: { type: 'string', description: '現場担当者向けの提案コメント（2〜4文）' },
    photoFindings: {
      type: 'array',
      description: '写真から読み取ったAI所見。写真が無ければ空配列',
      items: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['ok', 'warn', 'alert'] },
          text: { type: 'string' }
        },
        required: ['level', 'text'],
        additionalProperties: false
      }
    }
  },
  required: ['comment', 'photoFindings'],
  additionalProperties: false
};

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function buildUserText(b) {
  const c = b.computed || {};
  return [
    `【製品カテゴリ】${b.product || '不明'}`,
    `【現場担当の入力】\n${(b.inputs || []).map(x => '・' + x).join('\n') || '（なし）'}`,
    `【ルールエンジンの一次提案】`,
    `推奨：${c.type || ''}${c.frame ? '（' + c.frame + '）' : ''}`,
    `主要スペック：${(c.specs || []).join(' / ')}`,
    `生地候補：${(c.fabric || []).join('、')}`,
    `補強・取付：\n${(c.reinforce || []).map(x => '・' + x).join('\n')}`,
    `注意点：\n${(c.notes || []).map(x => '・' + x).join('\n')}`,
    `想定リスク：${(c.risks || []).join('・') || 'なし'}`,
    (b.photos && b.photos.length)
      ? `\n添付写真が ${b.photos.length} 枚あります。上記も踏まえ、comment と photoFindings を返してください。`
      : `\n写真は添付されていません。photoFindings は空配列にし、comment のみ返してください。`
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST のみ対応しています' });
    return;
  }
  try {
    // Vercel は JSON ボディを自動解析して req.body に入れる（生ストリームは消費済み）。
    // req.body が無い環境（ローカル簡易サーバー等）のみ自力で読む。
    const body = (req.body && typeof req.body === 'object') ? req.body : await readJson(req);

    // 画像ブロックを組み立て（安全のため最大6枚）
    const content = [];
    for (const p of (body.photos || []).slice(0, 6)) {
      const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(p || '');
      if (!m) continue;
      content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
    }
    content.push({ type: 'text', text: buildUserText(body) });

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } }
    });

    const textBlock = message.content.find(b => b.type === 'text');
    const data = JSON.parse(textBlock ? textBlock.text : '{}');
    res.status(200).json(data);
  } catch (e) {
    // フロント側はこのエラー時ローカルのテンプレ文にフォールバックする
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
