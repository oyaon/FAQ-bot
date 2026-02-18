import { pipeline } from '@xenova/transformers';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

async function regenerateOne(faqId) {
  console.log('⏳ Loading model...');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✅ Model loaded!\n');

  const { data: faq } = await supabase
    .from('faq')
    .select('id, question, answer')
    .eq('id', faqId)
    .single();

  if (!faq) {
    console.error('❌ FAQ not found');
    return;
  }

  const text = `Question: ${faq.question}\nAnswer: ${faq.answer}`;
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data);

  await supabase
    .from('faq')
    .update({ embedding })
    .eq('id', faqId);

  console.log(`✅ Updated FAQ ${faqId}: "${faq.question}"`);
}

const faqId = process.argv[2];
if (!faqId) {
  console.error('Usage: node scripts/regenerate-one.mjs <faq_id>');
  process.exit(1);
}

regenerateOne(parseInt(faqId)).catch(console.error);