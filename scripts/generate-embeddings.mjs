import { pipeline } from '@xenova/transformers';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables manually
const envFile = readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

// Validate credentials
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // Step 1: Load embedding model
  console.log('⏳ Loading embedding model (first run takes 1-2 minutes to download)...');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✅ Model loaded!\n');

  // Step 2: Fetch FAQs without embeddings
  const { data: faqs, error } = await supabase
    .from('faq')
    .select('id, question, answer')
    .is('embedding', null);

  if (error) {
    console.error('❌ Error fetching FAQs:', error.message);
    process.exit(1);
  }

  console.log(`📋 Found ${faqs.length} FAQs to embed\n`);

  // Step 3: Generate and store embeddings
  for (const faq of faqs) {
    try {
      // Just the question, no answer
      const text = faq.question;

      // Generate embedding
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);

      // Store in Supabase
      const { error: updateError } = await supabase
        .from('faq')
        .update({ embedding })
        .eq('id', faq.id);

      if (updateError) {
        console.error(`❌ Failed FAQ ${faq.id}:`, updateError.message);
      } else {
        console.log(`✅ FAQ ${faq.id}: "${faq.question.substring(0, 50)}..."`);
      }
    } catch (err) {
      console.error(`❌ Error on FAQ ${faq.id}:`, err.message);
    }
  }

  console.log('\n🎉 All embeddings generated and stored!');
  console.log('👉 Next step: Build the search endpoint');
}

main().catch(console.error);

