import { createClient } from '@supabase/supabase-js';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NEW_FAQS = [
  // Shipping category
  {
    question: 'How long does shipping take?',
    answer: 'Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days. Overnight shipping is available for orders placed before 2 PM EST.',
    category: 'Shipping',
  },
  {
    question: 'Do you offer free shipping?',
    answer: 'Yes! Free standard shipping on orders over $50. Orders under $50 have a flat $5.99 shipping fee. Free express shipping on orders over $150.',
    category: 'Shipping',
  },
  {
    question: 'Can I change my shipping address after ordering?',
    answer: 'If your order hasn\'t shipped yet, contact us within 2 hours and we can update it. If it has shipped, you\'ll need to refuse delivery and place a new order with the correct address.',
    category: 'Shipping',
  },
  {
    question: 'Do you ship internationally?',
    answer: 'Currently, we ship to Canada and Mexico only. International shipping to other countries is coming soon. Sign up for our newsletter to be notified.',
    category: 'Shipping',
  },
  
  // Account & Security
  {
    question: 'How do I create an account?',
    answer: 'Click "Sign Up" in the top right corner. Enter your email and create a password. You\'ll receive a confirmation email - click the link to activate your account.',
    category: 'Account',
  },
  {
    question: 'How do I reset my password?',
    answer: 'Go to the login page and click "Forgot Password". Enter your email address and we\'ll send you a password reset link. The link expires in 24 hours.',
    category: 'Account',
  },
  {
    question: 'Is my payment information secure?',
    answer: 'Yes. We use industry-standard SSL encryption and PCI DSS compliance. Your credit card data never touches our servers - it goes directly to our payment processor Stripe.',
    category: 'Account',
  },
  {
    question: 'How do I update my profile information?',
    answer: 'Log in to your account and go to "Settings" > "Profile". You can update your name, email, phone number, and shipping address.',
    category: 'Account',
  },

  // Product Info
  {
    question: 'What sizes do you carry?',
    answer: 'We carry sizes XS through XXL for apparel. Shoe sizes range from 5-14. All products show size charts on the product page.',
    category: 'Products',
  },
  {
    question: 'Are your products sustainable?',
    answer: 'All our products are made from sustainable materials. We use organic cotton, recycled polyester, and eco-friendly dyes. Learn more on our Sustainability page.',
    category: 'Products',
  },
  {
    question: 'Do you have gift cards?',
    answer: 'Yes! Digital gift cards are available in $25, $50, and $100 denominations. Physical gift cards are also available. They never expire.',
    category: 'Products',
  },
  {
    question: 'How long is the warranty on products?',
    answer: 'All items come with a 1-year quality guarantee. If a product has a defect, we\'ll replace it free of charge within the first year.',
    category: 'Products',
  },

  // Billing & Payments
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, Google Pay, and Klarna for installment payments.',
    category: 'Payment',
  },
  {
    question: 'Can I use multiple payment methods for one order?',
    answer: 'No, you can only use one primary payment method per order. However, you can split a gift card balance with another payment method.',
    category: 'Payment',
  },
  {
    question: 'Why was my card declined?',
    answer: 'Common reasons: insufficient funds, incorrect CVV, address mismatch, or fraud detection. Try again or contact your bank. If problems persist, use an alternative payment method.',
    category: 'Payment',
  },
  {
    question: 'How do I get an invoice?',
    answer: 'Invoices are automatically emailed after checkout. You can also download them from your account under "Order History" > "View Details" > "Download Invoice".',
    category: 'Payment',
  },

  // Promotions
  {
    question: 'How do I apply a coupon code?',
    answer: 'Enter the code in the "Promo Code" field at checkout. The discount will apply to your order total. Some codes have restrictions - check the terms.',
    category: 'Promotions',
  },
  {
    question: 'Do I get a welcome discount?',
    answer: 'New customers get 15% off their first order! Use code WELCOME15 at checkout. This code cannot be combined with other promotions.',
    category: 'Promotions',
  },
  {
    question: 'When do you have sales?',
    answer: 'We run seasonal sales in January, May, and August. Sign up for email notifications to get early access. VIP members get 48-hour early access.',
    category: 'Promotions',
  },

  // Orders & Tracking
  {
    question: 'How do I track my order?',
    answer: 'You\'ll receive a shipping confirmation email with a tracking link. You can also log into your account and go to "Order History" to see tracking details.',
    category: 'Orders',
  },
  {
    question: 'How long until I get my order?',
    answer: 'Processing takes 1-2 business days. Then add shipping time: Standard (5-7 days), Express (2-3 days), or Overnight (1 day).',
    category: 'Orders',
  },
  {
    question: 'Can I cancel my order?',
    answer: 'You can cancel orders that haven\'t shipped yet. Go to "Order History", select the order, and click "Cancel Order". If it has already shipped, you\'ll need to refuse delivery or request a return.',
    category: 'Orders',
  },

  // Returns
  {
    question: 'What is your return policy?',
    answer: 'You can return most items within 30 days of delivery for a full refund. Items must be unused, in original packaging, and with tags attached. Visit our Returns Portal to initiate a return.',
    category: 'Returns',
  },
  {
    question: 'What if my item arrives damaged or defective?',
    answer: 'If your item arrives damaged or defective, we are very sorry! Please take photos of the damage and contact our support team within 48 hours of delivery. We will immediately send you a replacement or issue a full refund - no need to return the damaged item. Email photos to support@company.com or use live chat for fastest resolution.',
    category: 'Returns',
  },
];

async function addFaqs() {
  console.log(`Adding ${NEW_FAQS.length} new FAQs...`);

  const { data, error } = await supabase
    .from('faq')
    .insert(NEW_FAQS)
    .select();

  if (error) {
    console.error('Error adding FAQs:', error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully added ${data.length} FAQs`);
  console.log('\nNew categories added:');
  const categories = [...new Set(data.map(f => f.category))];
  categories.forEach(cat => {
    const count = data.filter(f => f.category === cat).length;
    console.log(`  • ${cat}: ${count} FAQs`);
  });
}

addFaqs();
