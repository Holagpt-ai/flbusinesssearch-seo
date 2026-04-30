const { Client } = require('pg');

const client = new Client({
  host: 'db.vfftynfyxazjlzfrhwiw.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Sunbase2026!',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase');

  await client.query('SET statement_timeout = 0');

  console.log('Running category classification...');
  const result = await client.query(`
    UPDATE businesses SET
      category = CASE
        WHEN name ILIKE '%construct%' OR name ILIKE '%builder%' OR name ILIKE '%contractor%' OR name ILIKE '%roofing%' OR name ILIKE '%concrete%' OR name ILIKE '%drywall%' OR name ILIKE '%plumbing%' OR name ILIKE '%electrical%' OR name ILIKE '%hvac%' OR name ILIKE '%renovation%' OR name ILIKE '%remodel%' OR name ILIKE '%flooring%' OR name ILIKE '%carpentry%' OR name ILIKE '%handyman%' OR name ILIKE '%excavat%' OR name ILIKE '%paving%' OR name ILIKE '%stucco%' OR name ILIKE '%fencing%' OR name ILIKE '%demolition%' OR name ILIKE '%masonry%' OR name ILIKE '%framing%' THEN 'Construction'
        WHEN name ILIKE '%landscap%' OR name ILIKE '%lawn care%' OR name ILIKE '%lawn service%' OR name ILIKE '%irrigation%' OR name ILIKE '%tree service%' OR name ILIKE '%tree trim%' OR name ILIKE '%arborist%' OR name ILIKE '%garden%' OR name ILIKE '%turf%' OR name ILIKE '%mulch%' OR name ILIKE '%horticultur%' OR name ILIKE '%sod install%' THEN 'Landscaping'
        WHEN name ILIKE '%cleaning service%' OR name ILIKE '%janitorial%' OR name ILIKE '%maid service%' OR name ILIKE '%pressure wash%' OR name ILIKE '%power wash%' OR name ILIKE '%carpet clean%' OR name ILIKE '%window clean%' OR name ILIKE '%housekeeping%' OR name ILIKE '%sanitiz%' OR name ILIKE '%disinfect%' OR name ILIKE '%deep clean%' THEN 'Cleaning Services'
        WHEN name ILIKE '%medical%' OR name ILIKE '%dental%' OR name ILIKE '%clinic%' OR name ILIKE '%chiropractic%' OR name ILIKE '%therapy%' OR name ILIKE '%pharmacy%' OR name ILIKE '%rehab%' OR name ILIKE '%physician%' OR name ILIKE '%surgeon%' OR name ILIKE '%nursing%' OR name ILIKE '%hospice%' OR name ILIKE '%pediatric%' OR name ILIKE '%optometr%' OR name ILIKE '%psychiatr%' OR name ILIKE '%counseling%' OR name ILIKE '%mental health%' OR name ILIKE '%urgent care%' OR name ILIKE '%home care%' OR name ILIKE '%assisted living%' THEN 'Healthcare'
        WHEN name ILIKE '%insurance%' OR name ILIKE '%insure%' OR name ILIKE '%surety bond%' OR name ILIKE '%underwriting%' OR name ILIKE '%adjuster%' OR name ILIKE '%annuity%' THEN 'Insurance'
        WHEN name ILIKE '%software%' OR name ILIKE '%saas%' OR name ILIKE '%cyber%' OR name ILIKE '%it service%' OR name ILIKE '%information technology%' OR name ILIKE '%app develop%' OR name ILIKE '%web develop%' OR name ILIKE '%web design%' OR name ILIKE '%tech support%' OR name ILIKE '%managed service%' OR name ILIKE '%machine learning%' OR name ILIKE '%artificial intelligence%' OR name ILIKE '%cloud computing%' OR name ILIKE '%telecom%' THEN 'Technology'
        WHEN name ILIKE '%accounting%' OR name ILIKE '%bookkeeping%' OR name ILIKE '%tax preparation%' OR name ILIKE '%tax service%' OR name ILIKE '%payroll%' OR name ILIKE '%wealth management%' OR name ILIKE '%financial advisor%' OR name ILIKE '%certified public accountant%' OR name ILIKE '% cpa %' OR name ILIKE 'cpa %' THEN 'Accounting & Finance'
        WHEN name ILIKE '%attorney%' OR name ILIKE '%law firm%' OR name ILIKE '%legal aid%' OR name ILIKE '%litigation%' OR name ILIKE '%paralegal%' OR name ILIKE '%notary public%' OR name ILIKE '%legal counsel%' OR name ILIKE '% llp%' THEN 'Legal Services'
        WHEN name ILIKE '%insurance%' OR name ILIKE '%insure%' OR name ILIKE '%surety bond%' THEN 'Insurance'
        WHEN name ILIKE '%trucking%' OR name ILIKE '%logistics%' OR name ILIKE '%freight%' OR name ILIKE '%hauling%' OR name ILIKE '%moving company%' OR name ILIKE '%movers%' OR name ILIKE '%delivery service%' OR name ILIKE '%courier%' OR name ILIKE '%cargo%' OR name ILIKE '%transport%' OR name ILIKE '%chauffeur%' OR name ILIKE '%limo%' THEN 'Transportation'
        WHEN name ILIKE '%salon%' OR name ILIKE '%day spa%' OR name ILIKE '%med spa%' OR name ILIKE '%beauty%' OR name ILIKE '%nail salon%' OR name ILIKE '%barber%' OR name ILIKE '%cosmetology%' OR name ILIKE '%lashes%' OR name ILIKE '%waxing%' OR name ILIKE '%massage%' OR name ILIKE '%hair salon%' OR name ILIKE '%eyebrow%' OR name ILIKE '%tattoo%' OR name ILIKE '%skincare%' OR name ILIKE '%fitness%' OR name ILIKE '%yoga%' OR name ILIKE '%pilates%' OR name ILIKE '%gym%' OR name ILIKE '%wellness%' THEN 'Beauty & Wellness'
        WHEN name ILIKE '%church%' OR name ILIKE '%ministry%' OR name ILIKE '%ministries%' OR name ILIKE '%nonprofit%' OR name ILIKE '%non-profit%' OR name ILIKE '%charity%' OR name ILIKE '%outreach%' OR name ILIKE '%fellowship%' OR name ILIKE '%mosque%' OR name ILIKE '%synagogue%' OR name ILIKE '%temple%' OR name ILIKE '%faith%' OR name ILIKE '%diocese%' OR name ILIKE '%parish%' THEN 'Non-Profit & Religious'
        WHEN name ILIKE '%restaurant%' OR name ILIKE '%cafe%' OR name ILIKE '%catering%' OR name ILIKE '%bistro%' OR name ILIKE '%pizza%' OR name ILIKE '%bakery%' OR name ILIKE '%food truck%' OR name ILIKE '%brewery%' OR name ILIKE '%winery%' OR name ILIKE '%seafood%' OR name ILIKE '%burger%' OR name ILIKE '%steakhouse%' OR name ILIKE '%juice bar%' OR name ILIKE '%coffee shop%' THEN 'Food & Beverage'
        WHEN name ILIKE '%school%' OR name ILIKE '%academy%' OR name ILIKE '%tutoring%' OR name ILIKE '%childcare%' OR name ILIKE '%child care%' OR name ILIKE '%daycare%' OR name ILIKE '%preschool%' OR name ILIKE '%montessori%' OR name ILIKE '%learning center%' OR name ILIKE '%dance studio%' OR name ILIKE '%martial arts%' OR name ILIKE '%music lesson%' THEN 'Education'
        WHEN name ILIKE '%marketing%' OR name ILIKE '%advertising%' OR name ILIKE '%branding%' OR name ILIKE '%public relations%' OR name ILIKE '%social media%' OR name ILIKE '%graphic design%' OR name ILIKE '%photography%' THEN 'Marketing & Advertising'
        WHEN name ILIKE '%auto repair%' OR name ILIKE '%auto body%' OR name ILIKE '%auto detailing%' OR name ILIKE '%car wash%' OR name ILIKE '%car dealer%' OR name ILIKE '%towing%' OR name ILIKE '%mechanic%' OR name ILIKE '%transmission%' OR name ILIKE '%body shop%' OR name ILIKE '%auto glass%' THEN 'Automotive'
        WHEN name ILIKE '%realty%' OR name ILIKE '%realtor%' OR name ILIKE '%real estate%' OR name ILIKE '%property management%' OR name ILIKE '%mortgage%' OR name ILIKE '%title company%' OR name ILIKE '%apartment%' OR name ILIKE '%homebuilder%' THEN 'Real Estate'
        WHEN name ILIKE '%consulting%' OR name ILIKE '%staffing%' OR name ILIKE '%recruiting%' OR name ILIKE '%architecture%' OR name ILIKE '%event planning%' OR name ILIKE '%security guard%' OR name ILIKE '%security service%' OR name ILIKE '%environmental%' OR name ILIKE '%surveying%' THEN 'Professional Services'
        ELSE 'General Business'
      END,
      category_slug = CASE
        WHEN name ILIKE '%construct%' OR name ILIKE '%builder%' OR name ILIKE '%contractor%' OR name ILIKE '%roofing%' OR name ILIKE '%concrete%' OR name ILIKE '%drywall%' OR name ILIKE '%plumbing%' OR name ILIKE '%electrical%' OR name ILIKE '%hvac%' OR name ILIKE '%renovation%' OR name ILIKE '%remodel%' OR name ILIKE '%flooring%' OR name ILIKE '%carpentry%' OR name ILIKE '%handyman%' OR name ILIKE '%excavat%' OR name ILIKE '%paving%' OR name ILIKE '%stucco%' OR name ILIKE '%fencing%' OR name ILIKE '%demolition%' OR name ILIKE '%masonry%' OR name ILIKE '%framing%' THEN 'construction'
        WHEN name ILIKE '%landscap%' OR name ILIKE '%lawn care%' OR name ILIKE '%lawn service%' OR name ILIKE '%irrigation%' OR name ILIKE '%tree service%' OR name ILIKE '%tree trim%' OR name ILIKE '%arborist%' OR name ILIKE '%garden%' OR name ILIKE '%turf%' OR name ILIKE '%mulch%' OR name ILIKE '%horticultur%' OR name ILIKE '%sod install%' THEN 'landscaping'
        WHEN name ILIKE '%cleaning service%' OR name ILIKE '%janitorial%' OR name ILIKE '%maid service%' OR name ILIKE '%pressure wash%' OR name ILIKE '%power wash%' OR name ILIKE '%carpet clean%' OR name ILIKE '%window clean%' OR name ILIKE '%housekeeping%' OR name ILIKE '%sanitiz%' OR name ILIKE '%disinfect%' OR name ILIKE '%deep clean%' THEN 'cleaning-services'
        WHEN name ILIKE '%medical%' OR name ILIKE '%dental%' OR name ILIKE '%clinic%' OR name ILIKE '%chiropractic%' OR name ILIKE '%therapy%' OR name ILIKE '%pharmacy%' OR name ILIKE '%rehab%' OR name ILIKE '%physician%' OR name ILIKE '%surgeon%' OR name ILIKE '%nursing%' OR name ILIKE '%hospice%' OR name ILIKE '%pediatric%' OR name ILIKE '%optometr%' OR name ILIKE '%psychiatr%' OR name ILIKE '%counseling%' OR name ILIKE '%mental health%' OR name ILIKE '%urgent care%' OR name ILIKE '%home care%' OR name ILIKE '%assisted living%' THEN 'healthcare'
        WHEN name ILIKE '%insurance%' OR name ILIKE '%insure%' OR name ILIKE '%surety bond%' OR name ILIKE '%underwriting%' OR name ILIKE '%adjuster%' OR name ILIKE '%annuity%' THEN 'insurance'
        WHEN name ILIKE '%software%' OR name ILIKE '%saas%' OR name ILIKE '%cyber%' OR name ILIKE '%it service%' OR name ILIKE '%information technology%' OR name ILIKE '%app develop%' OR name ILIKE '%web develop%' OR name ILIKE '%web design%' OR name ILIKE '%tech support%' OR name ILIKE '%managed service%' OR name ILIKE '%machine learning%' OR name ILIKE '%artificial intelligence%' OR name ILIKE '%cloud computing%' OR name ILIKE '%telecom%' THEN 'technology'
        WHEN name ILIKE '%accounting%' OR name ILIKE '%bookkeeping%' OR name ILIKE '%tax preparation%' OR name ILIKE '%tax service%' OR name ILIKE '%payroll%' OR name ILIKE '%wealth management%' OR name ILIKE '%financial advisor%' OR name ILIKE '%certified public accountant%' OR name ILIKE '% cpa %' OR name ILIKE 'cpa %' THEN 'accounting-finance'
        WHEN name ILIKE '%attorney%' OR name ILIKE '%law firm%' OR name ILIKE '%legal aid%' OR name ILIKE '%litigation%' OR name ILIKE '%paralegal%' OR name ILIKE '%notary public%' OR name ILIKE '%legal counsel%' OR name ILIKE '% llp%' THEN 'legal-services'
        WHEN name ILIKE '%trucking%' OR name ILIKE '%logistics%' OR name ILIKE '%freight%' OR name ILIKE '%hauling%' OR name ILIKE '%moving company%' OR name ILIKE '%movers%' OR name ILIKE '%delivery service%' OR name ILIKE '%courier%' OR name ILIKE '%cargo%' OR name ILIKE '%transport%' OR name ILIKE '%chauffeur%' OR name ILIKE '%limo%' THEN 'transportation'
        WHEN name ILIKE '%salon%' OR name ILIKE '%day spa%' OR name ILIKE '%med spa%' OR name ILIKE '%beauty%' OR name ILIKE '%nail salon%' OR name ILIKE '%barber%' OR name ILIKE '%cosmetology%' OR name ILIKE '%lashes%' OR name ILIKE '%waxing%' OR name ILIKE '%massage%' OR name ILIKE '%hair salon%' OR name ILIKE '%eyebrow%' OR name ILIKE '%tattoo%' OR name ILIKE '%skincare%' OR name ILIKE '%fitness%' OR name ILIKE '%yoga%' OR name ILIKE '%pilates%' OR name ILIKE '%gym%' OR name ILIKE '%wellness%' THEN 'beauty-wellness'
        WHEN name ILIKE '%church%' OR name ILIKE '%ministry%' OR name ILIKE '%ministries%' OR name ILIKE '%nonprofit%' OR name ILIKE '%non-profit%' OR name ILIKE '%charity%' OR name ILIKE '%outreach%' OR name ILIKE '%fellowship%' OR name ILIKE '%mosque%' OR name ILIKE '%synagogue%' OR name ILIKE '%temple%' OR name ILIKE '%faith%' OR name ILIKE '%diocese%' OR name ILIKE '%parish%' THEN 'nonprofit-religious'
        WHEN name ILIKE '%restaurant%' OR name ILIKE '%cafe%' OR name ILIKE '%catering%' OR name ILIKE '%bistro%' OR name ILIKE '%pizza%' OR name ILIKE '%bakery%' OR name ILIKE '%food truck%' OR name ILIKE '%brewery%' OR name ILIKE '%winery%' OR name ILIKE '%seafood%' OR name ILIKE '%burger%' OR name ILIKE '%steakhouse%' OR name ILIKE '%juice bar%' OR name ILIKE '%coffee shop%' THEN 'food-beverage'
        WHEN name ILIKE '%school%' OR name ILIKE '%academy%' OR name ILIKE '%tutoring%' OR name ILIKE '%childcare%' OR name ILIKE '%child care%' OR name ILIKE '%daycare%' OR name ILIKE '%preschool%' OR name ILIKE '%montessori%' OR name ILIKE '%learning center%' OR name ILIKE '%dance studio%' OR name ILIKE '%martial arts%' OR name ILIKE '%music lesson%' THEN 'education'
        WHEN name ILIKE '%marketing%' OR name ILIKE '%advertising%' OR name ILIKE '%branding%' OR name ILIKE '%public relations%' OR name ILIKE '%social media%' OR name ILIKE '%graphic design%' OR name ILIKE '%photography%' THEN 'marketing-advertising'
        WHEN name ILIKE '%auto repair%' OR name ILIKE '%auto body%' OR name ILIKE '%auto detailing%' OR name ILIKE '%car wash%' OR name ILIKE '%car dealer%' OR name ILIKE '%towing%' OR name ILIKE '%mechanic%' OR name ILIKE '%transmission%' OR name ILIKE '%body shop%' OR name ILIKE '%auto glass%' THEN 'automotive'
        WHEN name ILIKE '%realty%' OR name ILIKE '%realtor%' OR name ILIKE '%real estate%' OR name ILIKE '%property management%' OR name ILIKE '%mortgage%' OR name ILIKE '%title company%' OR name ILIKE '%apartment%' OR name ILIKE '%homebuilder%' THEN 'real-estate'
        WHEN name ILIKE '%consulting%' OR name ILIKE '%staffing%' OR name ILIKE '%recruiting%' OR name ILIKE '%architecture%' OR name ILIKE '%event planning%' OR name ILIKE '%security guard%' OR name ILIKE '%security service%' OR name ILIKE '%environmental%' OR name ILIKE '%surveying%' THEN 'professional-services'
        ELSE 'general-business'
      END,
      enrichment_status = 'website_pending'
    WHERE category_slug IS NULL OR category_slug = ''
  `);

  console.log('Category classification done. Rows updated:', result.rowCount);

  console.log('Updating category business counts...');
  await client.query(`
    UPDATE categories c
    SET business_count = (
      SELECT COUNT(*) FROM businesses b
      WHERE b.category_slug = c.slug
    )
  `);

  console.log('Done. All categories updated.');
  await client.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
