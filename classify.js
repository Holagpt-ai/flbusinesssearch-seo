const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vfftynfyxazjlzfrhwiw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmZnR5bmZ5eGF6amx6ZnJod2l3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYyNjgyMCwiZXhwIjoyMDkyMjAyODIwfQ.nax8fCL798WKlrvtQ9oHYW1k6thhwNX8BvF57CYSmMY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function classify(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('construct') || n.includes('builder') || n.includes('contractor') || n.includes('roofing') || n.includes('plumbing') || n.includes('electrical') || n.includes('hvac') || n.includes('renovation') || n.includes('flooring') || n.includes('handyman') || n.includes('excavat') || n.includes('paving') || n.includes('masonry') || n.includes('drywall') || n.includes('fencing') || n.includes('demolition') || n.includes('stucco') || n.includes('carpentry')) return ['Construction', 'construction'];
  if (n.includes('landscap') || n.includes('lawn care') || n.includes('lawn service') || n.includes('irrigation') || n.includes('tree service') || n.includes('arborist') || n.includes('garden') || n.includes('turf') || n.includes('mulch') || n.includes('sod')) return ['Landscaping', 'landscaping'];
  if (n.includes('cleaning service') || n.includes('janitorial') || n.includes('maid service') || n.includes('pressure wash') || n.includes('power wash') || n.includes('housekeeping') || n.includes('deep clean') || n.includes('carpet clean')) return ['Cleaning Services', 'cleaning-services'];
  if (n.includes('medical') || n.includes('dental') || n.includes('clinic') || n.includes('therapy') || n.includes('pharmacy') || n.includes('physician') || n.includes('nursing') || n.includes('counseling') || n.includes('mental health') || n.includes('urgent care') || n.includes('assisted living') || n.includes('chiropractic') || n.includes('pediatric')) return ['Healthcare', 'healthcare'];
  if (n.includes('insurance') || n.includes('insure') || n.includes('surety bond') || n.includes('adjuster')) return ['Insurance', 'insurance'];
  if (n.includes('software') || n.includes('saas') || n.includes('cyber') || n.includes('it service') || n.includes('app develop') || n.includes('web develop') || n.includes('web design') || n.includes('tech support') || n.includes('cloud computing') || n.includes('telecom')) return ['Technology', 'technology'];
  if (n.includes('accounting') || n.includes('bookkeeping') || n.includes('tax preparation') || n.includes('tax service') || n.includes('payroll') || n.includes('financial advisor') || n.includes(' cpa ')) return ['Accounting & Finance', 'accounting-finance'];
  if (n.includes('attorney') || n.includes('law firm') || n.includes('litigation') || n.includes('paralegal') || n.includes('notary public') || n.includes(' llp')) return ['Legal Services', 'legal-services'];
  if (n.includes('trucking') || n.includes('logistics') || n.includes('freight') || n.includes('moving company') || n.includes('courier') || n.includes('transport') || n.includes('limo')) return ['Transportation', 'transportation'];
  if (n.includes('salon') || n.includes('beauty') || n.includes('nail salon') || n.includes('barber') || n.includes('massage') || n.includes('hair salon') || n.includes('tattoo') || n.includes('fitness') || n.includes('yoga') || n.includes('gym') || n.includes('wellness')) return ['Beauty & Wellness', 'beauty-wellness'];
  if (n.includes('church') || n.includes('ministry') || n.includes('nonprofit') || n.includes('non-profit') || n.includes('charity') || n.includes('fellowship') || n.includes('mosque') || n.includes('synagogue') || n.includes('temple')) return ['Non-Profit & Religious', 'nonprofit-religious'];
  if (n.includes('restaurant') || n.includes('cafe') || n.includes('catering') || n.includes('pizza') || n.includes('bakery') || n.includes('food truck') || n.includes('brewery') || n.includes('seafood') || n.includes('burger') || n.includes('coffee shop')) return ['Food & Beverage', 'food-beverage'];
  if (n.includes('school') || n.includes('academy') || n.includes('tutoring') || n.includes('childcare') || n.includes('daycare') || n.includes('preschool') || n.includes('dance studio') || n.includes('martial arts')) return ['Education', 'education'];
  if (n.includes('marketing') || n.includes('advertising') || n.includes('branding') || n.includes('public relations') || n.includes('social media') || n.includes('graphic design') || n.includes('photography')) return ['Marketing & Advertising', 'marketing-advertising'];
  if (n.includes('auto repair') || n.includes('auto body') || n.includes('car wash') || n.includes('towing') || n.includes('mechanic') || n.includes('auto glass')) return ['Automotive', 'automotive'];
  if (n.includes('realty') || n.includes('real estate') || n.includes('property management') || n.includes('mortgage') || n.includes('homebuilder')) return ['Real Estate', 'real-estate'];
  if (n.includes('consulting') || n.includes('staffing') || n.includes('recruiting') || n.includes('architecture') || n.includes('event planning') || n.includes('security guard') || n.includes('environmental')) return ['Professional Services', 'professional-services'];
  return ['General Business', 'general-business'];
}

async function run() {
  console.log('Connected to Supabase. Fetching unclassified businesses...');

  const BATCH = 1000;
  let offset = 0;
  let totalUpdated = 0;

  while (true) {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name')
      .or('category_slug.is.null,category_slug.eq.')
      .range(offset, offset + BATCH - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) { console.log('All rows classified.'); break; }

    console.log(`Processing batch at offset ${offset}: ${data.length} rows...`);

    const updates = data.filter(row => row.name && row.name.trim()).map(row => {
      const [category, category_slug] = classify(row.name);
      return { id: row.id, category, category_slug, enrichment_status: 'website_pending' };
    });

    const { error: upErr } = await supabase.from('businesses').upsert(updates, { onConflict: 'id' });
    if (upErr) { console.error('Update error:', upErr.message); break; }

    totalUpdated += data.length;
    console.log(`Total classified so far: ${totalUpdated}`);
    offset += BATCH;

    if (data.length < BATCH) break;
  }

  console.log('Updating category counts...');
  const { data: cats } = await supabase.from('categories').select('id, slug');
  for (const cat of cats || []) {
    const { count } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('category_slug', cat.slug);
    await supabase.from('categories').update({ business_count: count || 0 }).eq('id', cat.id);
  }

  console.log('Done. Total rows classified:', totalUpdated);
}

run().catch(e => { console.error(e.message); process.exit(1); });
