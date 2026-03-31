// ============================================================
// THE BARKING SPOON — Canine Nutrition Logic
// Version: 2.0 | March 2026
//
// Scientific Foundation:
//   - Small Animal Clinical Nutrition, 5th ed. (Hand, Thatcher et al.)
//   - NRC Nutrient Requirements of Dogs and Cats (2006)
//   - Linda P. Case: Canine and Feline Nutrition, 3rd ed.
//   - Peer-reviewed journals: JAVMA, JVIM, J Anim Physiol Anim Nutr
//
// Evidence Hierarchy (applied to every recommendation):
//   STRONG    — Multiple well-designed studies, consistent findings,
//               established mechanism
//   MODERATE  — 2–3 consistent studies, plausible mechanism,
//               clinical observation
//   EMERGING  — Single studies, preliminary data, plausible but
//               unconfirmed in canine subjects
//   REJECT    — Flawed methodology, contradicted by newer research,
//               marketing-driven, anecdotal only
//
// Philosophy: Nature-first WHERE evidence supports it.
// Willing to diverge from "natural" when science demands it.
// ============================================================


// ------------------------------------------------------------
// LIFE STAGE AUTO-DETECTION
// Based on growth plate closure timelines — the nutritionally
// critical transition, not arbitrary age cutoffs.
// Ref: Kealy et al., JAVMA 1992; Small Animal Clinical Nutrition
//      5th ed., Ch. 17; Sallander et al., Acta Vet Scand 2010
// ------------------------------------------------------------
function autoLifeStage(ageValue, ageUnit, breedSize) {
  let ageMonths = parseFloat(ageValue) || 0;
  if (ageUnit === 'years') ageMonths = ageMonths * 12;

  // Puppy to Adult: defined by growth plate closure
  // Feeding adult rations before closure risks skeletal disease
  // in large/giant breeds (HOD, OCD, hip dysplasia)
  const adultThreshold = {
    toy:    10,   // <5 kg: mature ~10 months
    small:  12,   // 5–10 kg: mature ~12 months
    medium: 15,   // 10–25 kg: mature ~15 months
    large:  21,   // 25–40 kg: mature 18–24 months
    giant:  24    // >40 kg: mature 24 months (some breeds up to 36)
  }[breedSize] || 15;

  // Adult to Senior: physiological aging threshold
  // Larger breeds experience earlier organ and metabolic decline
  const seniorThreshold = {
    toy:    132,  // ~11 years
    small:  120,  // ~10 years
    medium: 96,   // ~8 years
    large:  84,   // ~7 years
    giant:  72    // ~6 years
  }[breedSize] || 96;

  if (ageMonths < adultThreshold) return 'puppy';
  if (ageMonths >= seniorThreshold) return 'senior';
  return 'adult';
}

function breedSizeFromWeight(wt) {
  if (wt < 5)  return 'toy';
  if (wt < 10) return 'small';
  if (wt < 25) return 'medium';
  if (wt < 40) return 'large';
  return 'giant';
}


// ------------------------------------------------------------
// ADAPTIVE FEEDING CALCULATOR
// Method: % Body Weight — standard for raw and home-cooked
// feeding. Grounded in NRC MER with bioindividual adjustment.
// Ref: NRC (2006); Case et al., Canine & Feline Nutrition 3rd ed.
// ------------------------------------------------------------
function calcDog(d) {
  const w = d.wt;
  const ageMonths = d.ageu === 'years' ? (d.age || 0) * 12 : (d.age || 0);

  // Base % by life stage — NRC puppy MER is ~3x adult RER
  let pct;
  if (d.ls === 'puppy') {
    if (ageMonths <= 3)       pct = 8.0;   // Neonatal / rapid growth
    else if (ageMonths <= 6)  pct = 6.0;   // Active skeletal growth
    else if (ageMonths <= 9)  pct = 5.0;   // Decelerating growth
    else                       pct = 4.0;   // Near-adult, still growing
  } else if (d.ls === 'adult')      pct = 2.5;
  else if (d.ls === 'senior')       pct = 2.0;
  else if (d.ls === 'pregnant')     pct = 3.5;  // Last trimester ~50% above maintenance
  else if (d.ls === 'lactating')    pct = 5.0;  // Peak lactation up to 3–4x maintenance
  else                               pct = 2.5;

  // Activity modifier — aligned with NRC MER multipliers
  pct *= { sedentary: 0.80, moderate: 1.0, active: 1.2, working: 1.4 }[d.act] || 1.0;

  // BCS modifier
  pct *= { thin: 1.15, ideal: 1.0, over: 0.85, obese: 0.70 }[d.bcs] || 1.0;

  // Neuter modifier — neutered dogs have 20-30% lower energy needs
  // Ref: Laflamme, Vet Clin NA 2006; Root et al., JAVMA 1996
  if (d.neu === 'yes' && d.ls === 'adult') pct *= 0.90;

  // Breed size modifier — giant breeds have lower metabolic rate per kg
  const size = breedSizeFromWeight(w);
  if (size === 'giant') pct *= 0.85;
  if (size === 'toy')   pct *= 1.05;

  const totalG = Math.round(w * 1000 * pct / 100);
  // kcal per 100g: raw ~150, cooked ~120 (moisture loss concentrates energy), mixed ~135
  const kpg    = { raw: 150, cooked: 120, mixed: 135 }[d.diet] || 150;
  const kcal   = Math.round(totalG * kpg / 100);
  const meals  = parseInt(d.meals) || 3;

  return { kcal, totalG, pct: pct.toFixed(1), meals, perMeal: Math.round(totalG / meals) };
}


// ------------------------------------------------------------
// DIET COMPOSITION RATIOS
// BARF model grounded in whole-prey comparative anatomy.
// Ref: Billinghurst (1993); Lonsdale; refined by clinical
//      observation in domestic dogs
// ------------------------------------------------------------
function barfRatios(diet) {
  if (diet === 'raw') return [
    { l: 'Muscle Meat',         p: 70, c: '#e57373' },
    { l: 'Raw Meaty Bone',      p: 10, c: '#81c784' },
    { l: 'Liver',               p: 5,  c: '#ffb74d' },
    { l: 'Secreting Organs',    p: 5,  c: '#f06292' },
    { l: 'Vegetables & Fruit',  p: 7,  c: '#64b5f6' },
    { l: 'Seeds / Extras',      p: 3,  c: '#ba68c8' },
  ];
  if (diet === 'cooked') return [
    { l: 'Protein (Meat/Egg)',  p: 55, c: '#e57373' },
    { l: 'Carbohydrates',       p: 20, c: '#ffb74d' },
    { l: 'Calcium Source',      p: 10, c: '#81c784' },
    { l: 'Vegetables',          p: 12, c: '#64b5f6' },
    { l: 'Healthy Fats',        p: 3,  c: '#ba68c8' },
  ];
  return [
    { l: 'Raw Protein',         p: 45, c: '#e57373' },
    { l: 'Cooked Protein',      p: 20, c: '#ef9a9a' },
    { l: 'Bone / Calcium',      p: 10, c: '#81c784' },
    { l: 'Organ Meat',          p: 8,  c: '#ffb74d' },
    { l: 'Carbs + Veg',         p: 14, c: '#64b5f6' },
    { l: 'Fats / Extras',       p: 3,  c: '#ba68c8' },
  ];
}


// ------------------------------------------------------------
// SUPPLEMENT ENGINE — Evidence-Filtered
//
// Only STRONG and MODERATE evidence supplements are recommended
// by default. EMERGING supplements are flagged clearly.
// REJECTED supplements (single studies, marketing-driven,
// anecdotal) are not included.
//
// Each supplement:
//   n    — name
//   dose — weight-adjusted dosage
//   why  — evidence strength + source + mechanism
// ------------------------------------------------------------
function getSupplements(d) {
  const w = d.wt;
  const c = d.conds || [];
  const s = [];
  const add = (n, dose, why) => s.push({ n, dose, why });

  // ── Universal ──────────────────────────────────────────────

  add('Omega-3 / Fish Oil',
    `${Math.round(w * 20)}mg EPA+DHA/day`,
    'STRONG · Anti-inflammatory, skin barrier, brain health · Multiple RCTs in dogs · Roush et al., JAVMA 2010; Bauer, JVIM 2011');

  add('Kelp / Iodine Source',
    w < 10 ? '¼ tsp/day' : w < 30 ? '½ tsp/day' : '¾ tsp/day',
    'MODERATE · Iodine is NRC-required; whole-food diets without marine ingredients may be deficient · NRC (2006) Ch. 5');

  add('Probiotics',
    `${Math.max(1, Math.round(w / 10))} billion CFU/day`,
    'MODERATE for dietary transitions and post-antibiotic recovery · Weak evidence for routine prophylactic use in healthy dogs · Weese & Arroyo, JVIM 2003');

  // ── Puppy ─────────────────────────────────────────────────

  if (d.ls === 'puppy') {
    add('Vitamin D3',
      `${Math.round(w * 10)} IU/day`,
      'STRONG · Calcium-phosphorus metabolism; NRC-required; deficiency causes rickets · Small Animal Clinical Nutrition 5th ed., Ch. 17');

    if (d.diet !== 'raw')
      add('Calcium — Eggshell Powder',
        '1g per 100g food',
        'STRONG · Cooked diets lack bioavailable calcium from bone; eggshell Ca:P ratio closest to whole-prey · NRC (2006) minimum Ca requirements');

    add('DHA — Higher Dose',
      `${Math.round(w * 25)}mg EPA+DHA/day`,
      'STRONG · Critical for brain and retinal development in neonates · Heinemann et al., J Anim Physiol Anim Nutr 2005');
  }

  // ── Senior ────────────────────────────────────────────────

  if (d.ls === 'senior') {
    add('Digestive Enzymes',
      'Per product label — lipase + protease + amylase',
      'MODERATE · Pancreatic exocrine function declines with age, reducing nutrient absorption · Spillmann et al., JVIM 2001');

    add('CoQ10',
      `${Math.round(w * 1)}mg/day`,
      'MODERATE · Mitochondrial function; declines with age; cardiac and cognitive support in aging models · Bhagavan & Chopra, Mitochondrion 2006 (canine-specific data limited — disclose)');

    add('Omega-3 — Increased Dose',
      `${Math.round(w * 30)}mg EPA+DHA/day`,
      'MODERATE · Higher EPA/DHA for cognitive and joint support in ageing dogs · Araujo et al., Prog Neuropsychopharmacol 2005');
  }

  // ── Pregnant / Lactating ──────────────────────────────────

  if (d.ls === 'pregnant' || d.ls === 'lactating') {
    add('Folic Acid',
      '400mcg/day',
      'STRONG · NRC-recognised requirement for neural tube development in fetuses · NRC (2006) Ch. 15');

    add('Calcium — Eggshell',
      '1g per 100g food',
      'STRONG · Lactation dramatically increases calcium demand; eggshell most bioavailable whole-food source · Small Animal Clinical Nutrition 5th ed., Ch. 15');

    if (d.ls === 'lactating')
      add('Vitamin E',
        `${Math.round(w * 1.5)} IU/day`,
        'MODERATE · Oxidative stress increases during lactation; Vitamin E protects milk fat quality · NRC (2006); Zentek et al., Reprod Domest Anim 2012');
  }

  // ── Condition-Based ───────────────────────────────────────

  if (c.includes('skin')) {
    const fo = s.find(x => x.n.includes('Omega-3'));
    if (fo) fo.dose = `${Math.round(w * 35)}mg EPA+DHA/day (therapeutic dose for skin)`;

    add('Vitamin E',
      `${Math.round(w * 1)} IU/day`,
      'MODERATE · Works synergistically with omega-3 to reduce oxidative skin damage · Scott et al., Small Animal Dermatology 2001');

    add('Zinc — via Whole Food',
      'Increase red meat + organ frequency',
      'STRONG · Zinc deficiency directly causes skin and coat issues · Small Animal Clinical Nutrition 5th ed., Ch. 32 · Supplement only if deficiency confirmed — excess zinc is toxic');
  }

  if (c.includes('joint')) {
    add('Omega-3 — Joint Protocol',
      `${Math.round(w * 30)}mg EPA+DHA/day`,
      'STRONG · Reduces intraarticular inflammation; significant force plate improvement vs. placebo · Roush et al., JAVMA 2010 (RCT)');

    add('Turmeric / Curcumin',
      w < 10 ? '¼ tsp golden paste/day' : w < 30 ? '½ tsp/day' : '1 tsp/day',
      'MODERATE · Inhibits NF-κB inflammatory pathway; 2–3 canine studies · Must be golden paste (fat + black pepper) for bioavailability · Innes et al., J Nutr Sci 2016');

    add('Glucosamine + Chondroitin',
      `${Math.round(w * 20)}mg glucosamine/day`,
      'WEAK–CONFLICTING · Some studies show modest benefit; others show no difference from placebo · Johnston et al., JAVMA 2008 · Recommend omega-3 as primary intervention; glucosamine as adjunct only');
  }

  if (c.includes('digest')) {
    add('Slippery Elm Bark',
      `½ tsp per 10kg/day`,
      'EMERGING · Mucilaginous gut lining coating; plausible mechanism; limited canine RCTs · Monitor stool quality; discontinue if no improvement in 2 weeks');

    if (!s.find(x => x.n.includes('Digestive Enzymes')))
      add('Digestive Enzymes',
        'Per product label — lipase + protease',
        'MODERATE for malabsorption and EPI · Weak evidence for routine use in healthy dogs · Spillmann et al., JVIM 2001');

    add('L-Glutamine',
      `${Math.round(w * 50)}mg/day`,
      'MODERATE · Primary fuel for enterocytes; gut-healing in inflammatory conditions · Newsholme, J Nutr 2001 (canine-specific data emerging — disclose)');
  }

  if (c.includes('kidney')) {
    add('Omega-3 — Renal Protocol',
      `${Math.round(w * 25)}mg EPA+DHA/day`,
      'STRONG · Reduces intraglomerular hypertension; slows CKD progression · Brown et al., JAVMA 1998 (landmark canine RCT)');
  }

  if (c.includes('liver')) {
    add('Milk Thistle (Silymarin)',
      `${Math.round(w * 5)}mg/day`,
      'MODERATE · Inhibits hepatocyte lipid peroxidation; supports glutathione synthesis · Saller et al., Drugs 2001; canine pharmacokinetics available · Consult vet before use in hepatic disease');
  }

  if (c.includes('anxiety')) {
    add('L-Theanine',
      `${Math.round(w * 5)}mg/day`,
      'MODERATE · Promotes alpha brain wave activity; reduces stress markers in dogs · Araujo et al., J Vet Behav 2010 (placebo-controlled trial)');
  }

  if (c.includes('immune') || c.includes('cancer')) {
    add('Omega-3 — Anti-Cancer Dose',
      `${Math.round(w * 40)}mg EPA+DHA/day`,
      'STRONG · EPA/DHA disrupts tumour cell proliferation; prevents cachexia · Ogilvie et al., JAVMA 2000 (canine lymphoma RCT)');

    add('Vitamin D3 — Therapeutic',
      `${Math.round(w * 20)} IU/day`,
      'MODERATE · Low serum vitamin D correlates with cancer in dogs; repletion shows benefit · Selting et al., JVIM 2016 · Confirm serum 25-OHD levels before high-dose supplementation');
  }

  if (c.includes('heart')) {
    add('Taurine',
      `${Math.round(w * 25)}mg/day`,
      'STRONG · Taurine deficiency linked to DCM, especially in grain-free fed dogs · Kaplan et al., JVIM 2018 (FDA-linked study); NRC recognised requirement');

    add('L-Carnitine',
      `${Math.round(w * 50)}mg/day`,
      'MODERATE · Fatty acid transport into cardiac mitochondria; deficiency in Boxers/Dobermans documented · Keene et al., JAVMA 1991');

    add('CoQ10 — Cardiac Dose',
      `${Math.round(w * 2)}mg/day`,
      'MODERATE · Mitochondrial electron transport; clinical improvement in canine heart disease · Bhagavan & Chopra, Mitochondrion 2006 (limited canine RCT — disclose)');
  }

  if (c.includes('thyroid')) {
    const ki = s.findIndex(x => x.n.includes('Kelp'));
    if (ki >= 0) {
      s[ki].dose = '⚠ CAUTION — discontinue or use only under vet guidance';
      s[ki].why  = 'Iodine excess worsens both hypo- and hyperthyroidism · Discontinue until vet guidance obtained';
    }
    add('Selenium',
      `${Math.round(w * 2)}mcg/day`,
      'MODERATE · Required for T4→T3 deiodinase conversion · NRC (2006) recognised requirement · Do not exceed — selenium toxicity threshold is narrow');
  }

  if (d.bcs === 'over' || d.bcs === 'obese') {
    add('L-Carnitine',
      `${Math.round(w * 50)}mg/day`,
      'MODERATE · Facilitates mitochondrial fat oxidation; modest but consistent weight benefit in dogs · Gross et al., JAVMA 1998');
  }

  return s;
}


// ------------------------------------------------------------
// CLINICAL GUIDANCE — Vet Notes
// Evidence-cited condition-specific dietary guidance.
// Flags where veterinary consultation is required.
// ------------------------------------------------------------
function getVetNotes(dog) {
  const conds = dog.conds || [];
  const notes = [];

  if (dog.allrg)
    notes.push(`⚠ Known sensitivity: <b>${dog.allrg}</b> — eliminate strictly. Food sensitivities are IgE or T-cell mediated; even trace exposure can trigger response. Novel protein elimination diet for 8–12 weeks required for diagnosis confirmation (Verlinden et al., Crit Rev Food Sci 2006).`);

  if (conds.includes('kidney'))
    notes.push('Kidney (CKD): Moderate protein restriction reduces uraemic load — but excessive restriction causes muscle wasting (IRIS staging guides protein level). Restrict phosphorus (limit excess bone, organ). Increase hydration — bone broth or water added to every meal. Omega-3 at therapeutic dose slows progression (Brown et al., JAVMA 1998). Veterinary monitoring of BUN, creatinine, phosphorus required.');

  if (conds.includes('diabetes'))
    notes.push('Diabetes: Eliminate all simple carbohydrates and fruit entirely. Raw whole-food diet produces the lowest post-prandial glycaemic response (Fleeman & Rand, JAVMA 2001). Consistent meal timing is critical for insulin management. Feed equal portions at each meal. Blood glucose monitoring with vet essential — do not change diet without vet coordination.');

  if (conds.includes('cancer'))
    notes.push('Cancer: Tumour cells preferentially metabolise glucose — minimise all dietary carbohydrate. High fat, moderate protein, near-zero carb protocol supported by Ogilvie et al., JAVMA 2000. Significantly increase EPA/DHA (anti-cachexia and anti-proliferative — strong evidence). Avoid immune-stimulating supplements without oncology vet guidance — some stimulate tumour growth pathways.');

  if (conds.includes('liver'))
    notes.push('Liver Disease: Moderate protein prevents muscle wasting while limiting hepatic ammonia load. Prefer high-quality, easily digested protein (eggs, poultry). Avoid high-purine meats (sardines, excess organ meat) — worsen hepatic encephalopathy. Milk thistle (silymarin) — moderate evidence for hepatoprotection. Veterinary hepatic panel (ALT, ALP, bile acids) required for monitoring.');

  if (conds.includes('heart'))
    notes.push('Heart Disease: Taurine adequacy is critical — especially post grain-free or legume-heavy diet (FDA DCM investigation 2018–2019). Limit sodium. L-Carnitine and CoQ10 — moderate evidence for cardiac support. Regular echocardiogram and NT-proBNP monitoring with a cardiologist strongly recommended.');

  if (conds.includes('pancreatitis'))
    notes.push('Pancreatitis: Strict low-fat protocol is non-negotiable — dietary fat directly triggers pancreatic enzyme hypersecretion. Remove all bone, skin, duck, pork, and fatty fish. Lean white protein only (turkey breast, white fish, rabbit). Small frequent meals only. Monitor lipase/amylase with vet. A single high-fat meal can trigger a life-threatening acute flare.');

  if (dog.ls === 'senior')
    notes.push('Senior Nutrition: Current evidence supports maintaining or increasing protein to preserve lean muscle mass in older dogs — not reducing it (Freeman et al., JAVMA 2006). Warm food to body temperature (improves palatability as olfactory sensitivity declines). Feed 3 smaller meals rather than 2 large ones. Bi-annual full bloodwork panel strongly recommended.');

  return notes;
}


// ------------------------------------------------------------
// LIFE STAGE FEEDING NOTES
// ------------------------------------------------------------
function getDietNote(dog) {
  const notes = {
    puppy:
      `${dog.name} is in active development — reassess portions every 2 weeks until 6 months, then monthly. ` +
      `Transition to adult ratios only at breed-appropriate skeletal maturity — not a fixed age. Large breeds ` +
      `need puppy ratios until 18–24 months. Feed at room temperature — cold food slows gastric motility. ` +
      `Ref: Small Animal Clinical Nutrition 5th ed., Ch. 17`,

    adult:
      `Review ${dog.name}'s portions every 3 months based on weight trend and body condition — not a fixed schedule. ` +
      `Seasonal variation is real: reduce calories in summer heat, increase for active dogs in winter. ` +
      `Protein should remain high throughout adulthood. Ref: Case et al., Canine & Feline Nutrition 3rd ed.`,

    senior:
      `Senior dogs do NOT need reduced protein — evidence supports maintaining or increasing protein to prevent ` +
      `sarcopenia (Freeman et al., JAVMA 2006). What matters more: digestibility. Reduce meal size, increase to ` +
      `3–4 meals/day. Monitor weight closely — both loss (sarcopenia) and gain (metabolic slowdown) are common. ` +
      `Bi-annual vet bloodwork is essential.`,

    pregnant:
      `Maintain current portions in the first 5 weeks — overfeeding in early gestation causes excessive maternal ` +
      `weight gain with no fetal benefit. Gradually increase from week 5 — feed 25–50% above maintenance by week 9. ` +
      `Free-feed in the last 2 weeks before whelping. Ref: Small Animal Clinical Nutrition 5th ed., Ch. 15`,

    lactating:
      `${dog.name} may need up to 3–4× maintenance food at peak lactation (weeks 3–4 post-whelp). Feed ad-lib — ` +
      `do not restrict. High-calorie protein sources preferred (eggs, chicken thigh, fatty fish). Fresh water ` +
      `must be constantly available — dehydration directly reduces milk production. Reduce portions gradually ` +
      `as puppies are weaned (weeks 6–8).`
  };
  return notes[dog.ls] || '';
}


// ------------------------------------------------------------
// SUPPLEMENT INTRODUCTION NOTE
// ------------------------------------------------------------
function getSuppNote(dog) {
  if (dog.ls === 'puppy')
    return 'Introduce supplements one at a time, 5–7 days apart, from 8–10 weeks. Confirm with vet for pups under 12 weeks. Start at half dose and build to full over 2 weeks. Source human-grade or third-party tested products — pet supplement industry is largely unregulated.';

  return 'Introduce each supplement individually over 5–7 days. Monitor stool, energy, and coat response. Source human-grade or vet-grade brands; third-party tested preferred. Reassess need every 3–6 months — do not supplement indefinitely without reassessment.';
}


// ------------------------------------------------------------
// DOG EMOJI MAP & CONDITION LABELS
// ------------------------------------------------------------
const dogEmojis = {
  'Labrador Retriever': '🦮', 'Golden Retriever': '🦮',
  'German Shepherd': '🐕‍🦺', 'Belgian Malinois': '🐕‍🦺',
  'Australian Shepherd': '🐕‍🦺', 'Border Collie': '🐕‍🦺',
  'Pomeranian': '🐩', 'Shih Tzu': '🐩', 'Pug': '🐶',
  'Beagle': '🐕', 'Dachshund (Standard)': '🌭',
  'Dachshund (Miniature)': '🌭', 'Rottweiler': '🐾',
  'Siberian Husky': '🐺', 'French Bulldog': '🐶',
  'Mixed Breed': '🐶', 'Indian Pariah Dog (INDog)': '🐕',
};
function dogEmoji(d) { return dogEmojis[d.breed] || '🐕'; }

const condMap = {
  skin: 'Skin/Coat', joint: 'Joint', digest: 'Digestive',
  kidney: 'Kidney', diabetes: 'Diabetes', dental: 'Dental',
  anxiety: 'Anxiety', immune: 'Immune', cancer: 'Cancer',
  liver: 'Liver', heart: 'Heart', thyroid: 'Thyroid',
  pancreatitis: 'Pancreatitis',
};
