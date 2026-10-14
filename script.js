// WattWise BD — calculations, localStorage, translations, and charts
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const svgIcon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;

const readStored = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

let appliances = readStored('ww_appliances', []);
let bills = readStored('ww_bills', []);
const savedLang = localStorage.getItem('ww_lang');
let lang = savedLang === 'en' ? 'en' : 'bn';
let theme = localStorage.getItem('ww_theme') || 'light';
let editingApplianceId = null;
let billImageUrl = null;

function persistEstimateSettings() {
  const settings = {};
  ['slabLimit1', 'slabLimit2', 'slabRate1', 'slabRate2', 'slabRate3', 'fixedCharge', 'vatPercent', 'seasonProfile', 'sunHours', 'solarPerformance', 'costPerKw', 'solarOffsetTarget']
    .forEach(id => { const field = document.getElementById(id); if (field) settings[id] = field.value; });
  localStorage.setItem('ww_estimate_settings', JSON.stringify(settings));
}

function restoreEstimateSettings() {
  const settings = readStored('ww_estimate_settings', {});
  Object.entries(settings).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  });
}

function tariffCost(units) {
  const value = id => Math.max(0, Number(document.getElementById(id)?.value) || 0);
  const firstLimit = value('slabLimit1');
  const secondLimit = Math.max(firstLimit, value('slabLimit2'));
  const firstUnits = Math.min(units, firstLimit);
  const secondUnits = Math.max(0, Math.min(units, secondLimit) - firstLimit);
  const thirdUnits = Math.max(0, units - secondLimit);
  const energy = firstUnits * value('slabRate1') + secondUnits * value('slabRate2') + thirdUnits * value('slabRate3');
  return (energy + value('fixedCharge')) * (1 + value('vatPercent') / 100);
}

const t = {
  en: {
    nav_home: 'Home', nav_setup: 'Setup', nav_dashboard: 'Analysis', nav_solar: 'Solar', nav_history: 'History', nav_cta: 'Start Analysis',
    hero_title: 'Know where every <span>taka</span> of your electricity bill goes.',
    hero_sub: 'For Bangladeshi households & small shops. Estimate appliance-level cost, find bill villains, and plan rooftop solar — no login needed.',
    hero_btn1: 'Analyze My Bill →', hero_btn2: 'View Sample Report', sample_title: 'Sample Analysis',
    f1_t: 'Appliance Breakdown', f1_d: 'Cost per appliance with kWh formula: Watt × Hours × 30 / 1000',
    f2_t: 'Bill Villains', f2_d: 'Top 3 high-usage appliances that drive your bill',
    f3_t: 'Solar Planner', f3_d: 'Recommended kW, generation & payback for net metering',
    f4_t: 'Bill History', f4_d: 'Track trends & get abnormal-increase alerts', setup_title: 'Bill Setup',
    bill_amt: 'Monthly Bill (BDT)', units: 'Units Consumed (kWh)', price: 'Price per unit (BDT)', conn: 'Connection',
    goal: 'Savings Goal (BDT/month)', save_bill: 'Save Bill & Analyze', app_title: 'Appliance Builder',
    app_sub: 'Add your appliances — presets for Bangladesh', dash_title: 'AI Analysis Dashboard',
    s_total_kwh: 'Est. Monthly kWh', s_total_cost: 'Est. Monthly Cost', s_actual: 'Actual Bill', s_goal: 'Goal Progress'
  },
  bn: {
    nav_home: 'হোম', nav_setup: 'সেটআপ', nav_dashboard: 'বিশ্লেষণ', nav_solar: 'সোলার', nav_history: 'ইতিহাস', nav_cta: 'বিশ্লেষণ শুরু',
    hero_title: 'আপনার বিদ্যুৎ বিলের <span>প্রতি টাকা</span> কোথায় যায় জানুন।',
    hero_sub: 'বাংলাদেশি পরিবার ও ছোট দোকানের জন্য। অ্যাপ্লায়েন্স ভিত্তিক খরচ, বিল ভিলেন ও সোলার পরিকল্পনা।',
    hero_btn1: 'বিল বিশ্লেষণ করুন →', hero_btn2: 'নমুনা রিপোর্ট দেখুন', sample_title: 'নমুনা বিশ্লেষণ',
    f1_t: 'অ্যাপ্লায়েন্স ব্রেকডাউন', f1_d: 'Watt × ঘন্টা × ৩০ / ১০০০ ফর্মুলায় kWh হিসাব',
    f2_t: 'বিল ভিলেন', f2_d: 'সবচেয়ে বেশি বিদ্যুৎ খরচকারী ৩টি ডিভাইস', f3_t: 'সোলার প্ল্যানার',
    f3_d: 'প্রস্তাবিত kW, উৎপাদন ও পেব্যাক', f4_t: 'বিল ইতিহাস', f4_d: 'ট্রেন্ড ও অস্বাভাবিক বৃদ্ধির সতর্কতা',
    setup_title: 'বিল সেটআপ', bill_amt: 'মাসিক বিল (টাকা)', units: 'ইউনিট (kWh)', price: 'প্রতি ইউনিট দাম', conn: 'সংযোগ',
    goal: 'সঞ্চয় লক্ষ্য (টাকা/মাস)', save_bill: 'বিল সেভ ও বিশ্লেষণ', app_title: 'অ্যাপ্লায়েন্স বিল্ডার',
    app_sub: 'আপনার ডিভাইস যোগ করুন', dash_title: 'AI বিশ্লেষণ ড্যাশবোর্ড',
    s_total_kwh: 'আনুমানিক kWh', s_total_cost: 'আনুমানিক খরচ', s_actual: 'প্রকৃত বিল', s_goal: 'লক্ষ্য অগ্রগতি'
  }
};

const bnText = {
  'Loading energy insights...': 'শক্তি ব্যবহারের তথ্য লোড হচ্ছে...',
  'Initializing energy engine…': 'শক্তির ইঞ্জিন চালু হচ্ছে…',
  'Features': 'বৈশিষ্ট্য', 'How it works': 'যেভাবে কাজ করে', 'Solar': 'সোলার', 'FAQ': 'সাধারণ জিজ্ঞাসা',
  'Start Free Analysis →': 'বিনামূল্যে বিশ্লেষণ শুরু →', 'For Bangladeshi Homes & Small Shops': 'বাংলাদেশের বাড়ি ও ছোট দোকানের জন্য',
  'Know where every': 'আপনার বিদ্যুৎ বিলের', 'taka': 'প্রতি টাকা', 'of your electricity bill goes.': 'কোথায় যায় জানুন।',
  'WattWise BD analyzes your appliances, finds hidden power waste, and shows how much you can save with smarter usage and rooftop solar.': 'WattWise BD আপনার যন্ত্রপাতির বিদ্যুৎ খরচ বিশ্লেষণ করে, অপচয় খুঁজে বের করে এবং সচেতন ব্যবহার ও ছাদের সোলারে কত সাশ্রয় হতে পারে তা দেখায়।',
  'Analyze My Bill →': 'আমার বিল বিশ্লেষণ করুন →', 'See Sample Report': 'নমুনা রিপোর্ট দেখুন',
  'Estimates only. Actual savings may vary.': 'এগুলো আনুমানিক হিসাব। প্রকৃত সাশ্রয় ভিন্ন হতে পারে।',
  'Monthly bill: BDT 4,850': 'মাসিক বিল: ৪,৮৫০ টাকা', 'Potential savings BDT 1,240/mo': 'সম্ভাব্য সাশ্রয় ১,২৪০ টাকা/মাস',
  'AC 42%': 'এসি ৪২%', 'Fridge 18%': 'ফ্রিজ ১৮%', 'Fans 14%': 'ফ্যান ১৪%',
  'Top bill villain: 1.5-ton AC': 'বিলের প্রধান কারণ: ১.৫ টনের এসি', 'Solar payback: 3.8 years': 'সোলারের খরচ উঠবে: ৩.৮ বছরে',
  'Usage alert +18%': 'ব্যবহার বেড়েছে +১৮%', 'LED savings BDT 180/mo': 'এলইডিতে সাশ্রয় ১৮০ টাকা/মাস',
  '% potential bill reduction*': '% পর্যন্ত বিল সাশ্রয়ের সম্ভাবনা*', 'Appliance-level': 'যন্ত্রপাতিভিত্তিক', 'insights': 'বিশ্লেষণ',
  'years est. solar payback': 'বছর আনুমানিক সোলার খরচ ওঠার সময়', 'Bangla + English': 'বাংলা + ইংরেজি', 'built for BD': 'বাংলাদেশের জন্য',
  '*Potential/estimated, not guaranteed': '*সম্ভাব্য/আনুমানিক, নিশ্চিত নয়', 'How it works': 'যেভাবে কাজ করে',
  'Enter your bill': 'আপনার বিল লিখুন', 'Add monthly bill, units & connection type.': 'মাসিক বিল, ইউনিট ও সংযোগের ধরন যোগ করুন।',
  'Add appliances': 'যন্ত্রপাতি যোগ করুন', 'Choose AC, fridge, fan, pump, lights — set watt & hours.': 'এসি, ফ্রিজ, ফ্যান, পাম্প ও লাইট বেছে নিয়ে ওয়াট ও ব্যবহারের সময় দিন।',
  'Get your savings plan': 'সাশ্রয়ের পরিকল্পনা নিন', 'See cost breakdown, fixes & solar estimate instantly.': 'খরচের হিসাব, সাশ্রয়ের উপায় ও সোলারের অনুমান দেখুন।',
  'Open App Dashboard →': 'ড্যাশবোর্ড খুলুন →',   'Everything to cut waste, not comfort': 'স্বাচ্ছন্দ্য বজায় রেখে বিদ্যুৎ অপচয় কমান',
  'Appliance Cost Map': 'যন্ত্রপাতির খরচের হিসাব', 'kWh = Watt × Hours × 30 / 1000. Cost per device.': 'kWh = ওয়াট × ঘণ্টা × ৩০ / ১০০০। প্রতিটি যন্ত্রের খরচ।',
  'Savings Coach': 'সাশ্রয়ের পরামর্শ', 'Ranked actions with BDT/month & yearly savings.': 'মাসিক ও বার্ষিক সাশ্রয়ের সম্ভাবনাসহ করণীয়।',
  'Bill History': 'বিলের ইতিহাস', 'Save in localStorage, compare months.': 'তথ্য সংরক্ষণ করে মাসভিত্তিক তুলনা করুন।',
  'Usage Alerts': 'ব্যবহারের সতর্কতা', 'Detects abnormal increase automatically.': 'অস্বাভাবিক বৃদ্ধি স্বয়ংক্রিয়ভাবে শনাক্ত করে।',
  'Solar Planner': 'সোলার পরিকল্পনা', 'kW size, generation, bill cut & payback.': 'সিস্টেমের ক্ষমতা, উৎপাদন, বিল সাশ্রয় ও খরচ ওঠার সময়।',
  'Printable Report': 'প্রিন্টযোগ্য রিপোর্ট', 'One-page clean report - in the App.': 'অ্যাপে সহজে প্রিন্টযোগ্য এক পাতার রিপোর্ট।',
  'Should you install rooftop solar?': 'ছাদে সোলার বসানো কি আপনার জন্য উপযোগী?',
  'Move the slider — estimate updates live. Full calculator inside the App.': 'স্লাইডার সরালে হিসাব সঙ্গে সঙ্গে বদলাবে। সম্পূর্ণ ক্যালকুলেটর অ্যাপে।',
  'Monthly bill:': 'মাসিক বিল:', 'System': 'সিস্টেম', 'Yearly Save': 'বার্ষিক সাশ্রয়', 'Payback': 'খर्च ওঠার সময়',
  'Calculate My Solar →': 'সোলারের হিসাব করুন →', 'Net metering • Estimates only': 'নেট মিটারিং • আনুমানিক হিসাব',
  'Is WattWise BD free?': 'WattWise BD কি বিনামূল্যে?', 'Yes, runs fully in your browser with localStorage. No login.': 'হ্যাঁ, এটি আপনার ব্রাউজারেই চলে এবং তথ্য সেখানেই সংরক্ষণ করে। লগইন লাগবে না।',
  'Are savings guaranteed?': 'সাশ্রয় কি নিশ্চিত?', 'No. All results are estimates based on Watt × Hours. Actual tariff/weather vary.': 'না। ওয়াট ও ব্যবহারের সময় ধরে সব হিসাব অনুমান করা হয়। প্রকৃত тариф ও আবহাওয়ায় ফল ভিন্ন হতে পারে।',
  'Do I need a smart meter?': 'স্মার্ট মিটার লাগবে কি?', 'No. Just enter your monthly bill and units.': 'না। শুধু মাসিক বিল ও ইউনিট লিখুন।',
  'How does solar estimate work?': 'সোলারের হিসাব কীভাবে হয়?', 'System kW ≈ monthly kWh / (30 × 4.2 × 0.8). Payback = cost / yearly savings. Inside the app.': 'সিস্টেমের kW ≈ মাসিক kWh / (৩০ × ৪.২ × ০.৮)। খরচ ওঠার সময় = সিস্টেমের দাম / বার্ষিক সাশ্রয়। বিস্তারিত অ্যাপে।',
  'Start your free bill analysis today': 'আজই বিনামূল্যে বিদ্যুৎ বিল বিশ্লেষণ করুন', 'Know where every taka goes — in 2 minutes.': 'মাত্র ২ মিনিটে জানুন আপনার প্রতিটি টাকা কোথায় যায়।',
  'Analyze My Bill — Free →': 'বিল বিশ্লেষণ করুন — বিনামূল্যে →', 'AI bill analysis & solar planner for Bangladesh. Estimate-first.': 'বাংলাদেশের জন্য বিদ্যুৎ বিল বিশ্লেষণ ও সোলার পরিকল্পনা। সব হিসাবই আনুমানিক।',
  'Product': 'পণ্য', 'Company': 'প্রতিষ্ঠান', 'Contact': 'যোগাযোগ', 'App Dashboard': 'অ্যাপ ড্যাশবোর্ড', 'Solar Planner': 'সোলার পরিকল্পনা',
  'About': 'আমাদের সম্পর্কে', 'Privacy': 'গোপনীয়তা', 'Dhaka, Bangladesh': 'ঢাকা, বাংলাদেশ',
  'Your Energy Dashboard': 'আপনার বিদ্যুৎ ব্যবহারের ড্যাশবোর্ড', 'Estimates only. Actual usage and savings may vary.': 'এগুলো আনুমানিক হিসাব। প্রকৃত ব্যবহার ও সাশ্রয় ভিন্ন হতে পারে।',
  'Bill Setup': 'বিলের তথ্য', 'Monthly Bill (BDT)': 'মাসিক বিল (টাকা)', 'Units Consumed (kWh)': 'ব্যবহৃত ইউনিট (kWh)',
  'Price per unit (BDT)': 'প্রতি ইউনিটের দাম (টাকা)', 'Month': 'মাস', 'Connection': 'সংযোগ', 'Single Phase': 'সিঙ্গেল ফেজ', 'Three Phase': 'থ্রি ফেজ',
  'Type': 'ধরন', 'Home': 'বাসা', 'Shop': 'দোকান', 'Flat': 'ফ্ল্যাট', 'Location': 'অবস্থান', 'Dhaka': 'ঢাকা', 'Chattogram': 'চট্টগ্রাম',
  'Rajshahi': 'রাজশাহী', 'Khulna': 'খুলনা', 'Sylhet': 'সিলেট', 'Savings Goal (BDT/month)': 'সাশ্রয়ের লক্ষ্য (টাকা/মাস)',
  'Save Bill & Analyze': 'বিল সংরক্ষণ ও বিশ্লেষণ', 'Appliance Builder': 'যন্ত্রপাতি যোগ করুন',
  'Presets for Bangladesh — Watt × Hours × 30 / 1000': 'বাংলাদেশের প্রচলিত যন্ত্র — ওয়াট × ঘণ্টা × ৩০ / ১০০০',
  'Custom': 'নিজস্ব', 'AC 1.5 Ton — 1500W': '১.৫ টনের এসি — ১৫০০ ওয়াট', 'Refrigerator — 150W': 'ফ্রিজ — ১৫০ ওয়াট',
  'Ceiling Fan — 100W': 'সিলিং ফ্যান — ১০০ ওয়াট', 'LED Light — 12W': 'এলইডি বাতি — ১২ ওয়াট', 'Iron — 1000W': 'ইস্ত্রি — ১০০০ ওয়াট',
  'Water Pump — 750W': 'পানির পাম্প — ৭৫০ ওয়াট', 'TV — 80W': 'টিভি — ৮০ ওয়াট', 'Computer — 200W': 'কম্পিউটার — ২০০ ওয়াট',
  'Name': 'নাম', 'Watt': 'ওয়াট', 'Hrs': 'ঘণ্টা', '+ Add': '+ যোগ করুন',
  'No appliances yet. Add AC, Fridge, Fans to see analysis.': 'এখনো কোনো যন্ত্র যোগ করা হয়নি। বিশ্লেষণের জন্য এসি, ফ্রিজ বা ফ্যান যোগ করুন।',
  'AI Analysis Dashboard': 'বিদ্যুৎ ব্যবহারের বিশ্লেষণ', 'Est. Monthly kWh': 'আনুমানিক মাসিক kWh', 'Est. Monthly Cost': 'আনুমানিক মাসিক খরচ',
  'Actual Bill': 'প্রকৃত বিল', 'Goal Progress': 'লক্ষ্যের অগ্রগতি',   'Cost Breakdown': 'খরচের বিবরণ', 'Top 3 Bill Villains': 'বিলের প্রধান ৩ কারণ',
  'Bill History': 'বিলের ইতিহাস', 'Print / Save PDF': 'প্রিন্ট / PDF সংরক্ষণ',
  'Based on your usage. Est. generation = kW × 4.2 sun hrs × 30 × 0.8 efficiency. Estimates only.': 'আপনার ব্যবহার অনুযায়ী হিসাব। আনুমানিক উৎপাদন = kW × দৈনিক ৪.২ ঘণ্টা রোদ × ৩০ × ০.৮ দক্ষতা। হিসাবটি আনুমানিক।',
  'Recommended': 'প্রস্তাবিত', 'Rooftop': 'ছাদের জন্য', 'Est. Generation': 'আনুমানিক উৎপাদন', '~4.2 hrs/day': 'প্রায় ৪.২ ঘণ্টা/দিন',
  'Bill Reduction': 'বিল সাশ্রয়', 'Bill History': 'বিলের ইতিহাস', 'History Table': 'ইতিহাসের তালিকা', 'Clear History': 'ইতিহাস মুছুন',
  'WattWise BD — Energy Report': 'WattWise BD — বিদ্যুৎ ব্যবহারের রিপোর্ট', 'Print / Save PDF': 'প্রিন্ট / PDF সংরক্ষণ',
  'No bills saved yet.': 'এখনো কোনো বিল সংরক্ষণ করা হয়নি.', 'Month': 'মাস', 'Bill': 'বিল', 'Units': 'ইউনিট',
  'Estimates only. Actual usage and savings may vary. Not a substitute for DPDC/DESCO/BPDB billing.': 'এগুলো আনুমানিক হিসাব। প্রকৃত ব্যবহার ও সাশ্রয় ভিন্ন হতে পারে। DPDC/DESCO/BPDB বিলের বিকল্প নয়।',
  'Home': 'হোম', 'Setup': 'তথ্য দিন', 'Analysis': 'বিশ্লেষণ', 'History': 'ইতিহাস', '← Back to Site': '← মূল সাইটে ফিরুন',
  'English': 'English', 'বাংলা': 'বাংলা',
  'Tariff estimate settings': 'ট্যারিফের আনুমানিক হিসাব', 'Illustrative defaults only. Set rates from your own utility bill; these are not official tariff rates.': 'এগুলো শুধু উদাহরণ। নিজের বিদ্যুৎ বিল দেখে হার বসান; এগুলো সরকারি ট্যারিফ নয়।',
  'First slab limit (kWh)': 'প্রথম ধাপের সীমা (kWh)', 'Second slab limit (kWh)': 'দ্বিতীয় ধাপের সীমা (kWh)',
  'Rate up to first limit (BDT/kWh)': 'প্রথম সীমা পর্যন্ত হার (টাকা/kWh)', 'Rate up to second limit': 'দ্বিতীয় সীমা পর্যন্ত হার',
  'Rate above second limit (BDT/kWh)': 'দ্বিতীয় সীমার বেশি ব্যবহারের হার (টাকা/kWh)', 'Fixed monthly charge (BDT)': 'মাসিক নির্দিষ্ট চার্জ (টাকা)', 'VAT (%)': 'ভ্যাট (%)',
  'Upload bill image for reference': 'রেফারেন্সের জন্য বিলের ছবি দিন', 'Usage season': 'ব্যবহারের মৌসুম', 'Typical month': 'সাধারণ মাস', 'Summer (+25%)': 'গ্রীষ্ম (+২৫%)', 'Winter (−10%)': 'শীত (−১০%)',
  'Cancel edit': 'সম্পাদনা বাতিল', 'Adjust solar assumptions': 'সোলারের অনুমান পরিবর্তন করুন', 'Starting values are planning assumptions, not a supplier quote or guaranteed output.': 'প্রাথমিক মানগুলো পরিকল্পনার অনুমান; সরবরাহকারীর কোটেশন বা নিশ্চিত উৎপাদন নয়।',
  'Sun hours/day': 'প্রতিদিন রোদ (ঘণ্টা)', 'System performance (%)': 'সিস্টেমের কার্যক্ষমতা (%)', 'Installed cost per kW (BDT)': 'প্রতি kW স্থাপনের খরচ (টাকা)',
  'Target offset of usage (%)': 'ব্যবহারের কত অংশ অফসেট করবেন (%)',
  'Export history CSV': 'ইতিহাস CSV হিসেবে ডাউনলোড', 'Privacy & data': 'গোপনীয়তা ও তথ্য', 'Your bills, appliances, and preferences are stored in this browser\'s local storage. The bill image is only previewed in this page and is not uploaded or saved.': 'আপনার বিল, যন্ত্রপাতি ও পছন্দ এই ব্রাউজারেই সংরক্ষিত থাকে। বিলের ছবি শুধু এই পাতায় দেখা যায়; আপলোড বা সংরক্ষণ করা হয় না।',
  'Clear all saved data': 'সব সংরক্ষিত তথ্য মুছুন', 'Slab bill estimate': 'ধাপভিত্তিক বিলের অনুমান', 'Est. Appliance Cost': 'যন্ত্রপাতির আনুমানিক খরচ',
  'AC 26°C + clean filter': 'এসি ২৬°C + ফিল্টার পরিষ্কার', 'Raise AC to 26°C and clean filter monthly.': 'এসি ২৬°C-এ রাখুন এবং মাসে ফিল্টার পরিষ্কার করুন।', 'Replace bulbs with LED': 'বাতি LED দিয়ে বদলান',
  '5x 12W LED vs 60W bulbs saves ~15 kWh/mo.': '৫টি ১২W LED, ৬০W বাল্বের তুলনায় প্রায় ১৫ kWh/মাস সাশ্রয় করতে পারে।', 'Stop standby power': 'স্ট্যান্ডবাই বিদ্যুৎ বন্ধ করুন', 'Use power strip for TV/Computer.': 'টিভি/কম্পিউটারের জন্য পাওয়ার স্ট্রিপ ব্যবহার করুন।',
  'Run pump at off-peak': 'কম ব্যবহারের সময়ে পাম্প চালান', 'Shift pump/microwave to morning.': 'পাম্প/মাইক্রোওয়েভ সকালে চালানোর চেষ্টা করুন।', 'Edit': 'সম্পাদনা', 'Add appliances to identify villains.': 'প্রধান বিদ্যুৎখেকো যন্ত্র দেখতে যন্ত্রপাতি যোগ করুন।'
};
const originalText = new WeakMap();
const originalHtml = new WeakMap();

function updateThemeToggles() {
  const icon = theme === 'dark' ? 'sun' : 'moon';
  const label = lang === 'bn'
    ? (theme === 'dark' ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন')
    : (theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  document.querySelectorAll('#themeToggle, #themeToggle2').forEach(button => {
    button.innerHTML = svgIcon(icon);
    button.setAttribute('aria-label', label);
    button.title = label;
  });
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (!originalHtml.has(el)) originalHtml.set(el, el.innerHTML);
    const key = el.getAttribute('data-i18n');
    const original = originalHtml.get(el);
    el.innerHTML = lang === 'bn' ? (t.bn?.[key] || bnText[original] || original) : (t.en?.[key] || original);
  });

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('[data-i18n]')) continue;
    if (node.parentElement?.closest('#preloader')) continue;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const original = originalText.get(node);
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = lang === 'bn' ? (bnText[trimmed] || trimmed) : trimmed;
    node.nodeValue = original.replace(trimmed, translated);
  }

  document.querySelectorAll('[placeholder]').forEach(el => {
    if (!el.dataset.originalPlaceholder) el.dataset.originalPlaceholder = el.placeholder;
    const original = el.dataset.originalPlaceholder;
    el.placeholder = lang === 'bn' ? (bnText[original] || original) : original;
  });
  document.querySelectorAll('#langToggle, #langToggle2').forEach(button => {
    button.textContent = lang === 'en' ? 'বাংলা' : 'English';
  });
  document.documentElement.lang = lang;
  updateThemeToggles();
  document.body.style.fontFamily = lang === 'bn' ? "'Hind Siliguri', Inter, sans-serif" : 'Inter, sans-serif';
  document.title = lang === 'bn' ? 'WattWise BD — বিদ্যুৎ বিল বিশ্লেষণ' : (document.body.querySelector('#applianceList') ? 'WattWise BD — App Dashboard' : 'WattWise BD — Know where every taka goes');
}

function calcKwh(watt, hours, days = 30, qty = 1) {
  return watt * hours * days * qty / 1000;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

$('#preset')?.addEventListener('change', event => {
  if (!event.target.value) return;
  const [name, watt] = event.target.value.split('|');
  $('#aName').value = name;
  $('#aWatt').value = watt;
});

function addAppliance() {
  const name = $('#aName').value.trim();
  const watt = parseFloat($('#aWatt').value);
  const qty = parseInt($('#aQty').value, 10) || 1;
  const hours = parseFloat($('#aHours').value);
  if (!name || !Number.isFinite(watt) || watt <= 0 || !Number.isFinite(hours) || hours <= 0 || hours > 24 || qty < 1) {
    alert('Enter a name, positive wattage, quantity, and daily hours (up to 24).');
    return;
  }
  if (editingApplianceId !== null) {
    appliances = appliances.map(item => item.id === editingApplianceId ? { ...item, name, watt, qty, hours } : item);
    cancelApplianceEdit();
  } else {
    appliances.push({ id: Date.now(), name, watt, qty, hours });
  }
  save();
  $('#aName').value = '';
}

function editAp(id) {
  const appliance = appliances.find(item => item.id === id);
  if (!appliance) return;
  editingApplianceId = id;
  $('#aName').value = appliance.name;
  $('#aWatt').value = appliance.watt;
  $('#aQty').value = appliance.qty;
  $('#aHours').value = appliance.hours;
  $('#applianceSubmit').textContent = lang === 'bn' ? 'পরিবর্তন সংরক্ষণ' : 'Save changes';
  $('#cancelEdit').hidden = false;
  $('#aName').focus();
}

function cancelApplianceEdit() {
  editingApplianceId = null;
  if ($('#applianceSubmit')) $('#applianceSubmit').textContent = lang === 'bn' ? '+ যোগ করুন' : '+ Add';
  if ($('#cancelEdit')) $('#cancelEdit').hidden = true;
}

function removeAp(id) {
  appliances = appliances.filter(appliance => appliance.id !== id);
  save();
}

function saveBill() {
  const bill = {
    amount: parseFloat($('#billAmount').value) || 0,
    units: parseFloat($('#billUnits').value) || 0,
    month: $('#billMonth').value || new Date().toISOString().slice(0, 7),
    price: parseFloat($('#pricePerUnit').value) || 12,
    goal: parseFloat($('#goalInput').value) || 0
  };
  bills.push(bill);
  if (bills.length > 12) bills.shift();
  localStorage.setItem('ww_bills', JSON.stringify(bills));
  renderAll();
  location.hash = '#dashboard';
}

function clearHistory() {
  bills = [];
  localStorage.removeItem('ww_bills');
  renderAll();
}

function save() {
  localStorage.setItem('ww_appliances', JSON.stringify(appliances));
  renderAll();
}

let donut, line;

function renderAll() {
  localStorage.setItem('ww_lang', lang);
  localStorage.setItem('ww_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeToggles();
  applyLang();

  const list = $('#applianceList');
  list.innerHTML = '';
  $('#emptyApp').style.display = appliances.length ? 'none' : 'block';
  let totalKwh = 0;
  let totalCost = 0;
  const price = parseFloat($('#pricePerUnit').value) || 12;
  const seasonFactor = Number($('#seasonProfile')?.value) || 1;
  const enriched = appliances.map(appliance => {
    const kwh = calcKwh(appliance.watt, appliance.hours, 30, appliance.qty) * seasonFactor;
    const cost = kwh * price;
    totalKwh += kwh;
    totalCost += cost;
    return { ...appliance, kwh, cost };
  }).sort((a, b) => b.cost - a.cost);

  enriched.forEach(appliance => {
    const div = document.createElement('div');
    div.className = 'app-item';
    div.innerHTML = `<div><b>${escapeHtml(appliance.name)} ×${appliance.qty}</b><br><small>${appliance.watt}W • ${appliance.hours}h/day • ${appliance.kwh.toFixed(1)} kWh • BDT ${appliance.cost.toFixed(0)}</small></div><div class="appliance-actions"><button class="pill" onclick="editAp(${Number(appliance.id)})">${lang === 'bn' ? 'সম্পাদনা' : 'Edit'}</button><button class="pill" aria-label="Remove ${escapeHtml(appliance.name)}" onclick="removeAp(${Number(appliance.id)})">✕</button></div>`;
    list.appendChild(div);
  });

  $('#totalKwh').textContent = totalKwh.toFixed(1);
  $('#totalCost').textContent = (lang === 'bn' ? 'টাকা ' : 'BDT ') + Math.round(totalCost);
  $('#priceHint').textContent = lang === 'bn' ? `প্রতি ইউনিট ${price} টাকা` : `at BDT ${price}/unit`;
  if ($('#tariffEstimate')) $('#tariffEstimate').textContent = 'BDT ' + Math.round(tariffCost(totalKwh));
  const latestBill = bills[bills.length - 1];
  const actual = parseFloat($('#billAmount').value) || (latestBill?.amount || 0);
  $('#actualBill').textContent = 'BDT ' + (actual || 0);
  const diff = actual ? Math.round(totalCost - actual) : 0;
  $('#diffHint').textContent = actual
    ? (diff > 0 ? `+BDT ${diff} over estimate` : `BDT ${Math.abs(diff)} under`)
    : 'Enter bill to compare';

  const goal = parseFloat($('#goalInput').value) || (latestBill?.goal || 0);
  const savable = enriched.slice(0, 3).reduce((sum, appliance) => sum + appliance.cost * 0.25, 0);
  const progress = goal ? Math.min(100, Math.round(savable / goal * 100)) : 0;
  $('#goalText').textContent = goal
    ? `BDT ${Math.round(savable)} / ${goal} (${progress}%)`
    : `Potential BDT ${Math.round(savable)}/mo`;
  $('#goalBar').style.width = progress + '%';

  const villains = $('#villains');
  villains.innerHTML = '';
  enriched.slice(0, 3).forEach((appliance, index) => {
    const percent = totalCost ? Math.round(appliance.cost / totalCost * 100) : 0;
    villains.innerHTML += `<div class="villain"><span>#${index + 1} ${escapeHtml(appliance.name)}</span><span><b>BDT ${Math.round(appliance.cost)}</b> • ${percent}%</span></div>`;
  });
  if (!enriched.length) villains.innerHTML = '<p class="muted">Add appliances to identify villains.</p>';

  const applianceNames = enriched.map(item => item.name.toLowerCase()).join(' ');
  const tips = [
    ...(applianceNames.includes('ac') ? [{ title: 'AC 26°C + clean filter', save: 360, desc: 'Raise AC to 26°C and clean filter monthly.' }] : []),
    ...(applianceNames.includes('light') || applianceNames.includes('bulb') ? [{ title: 'Replace bulbs with LED', save: 180, desc: '5x 12W LED vs 60W bulbs saves ~15 kWh/mo.' }] : []),
    ...(applianceNames.includes('tv') || applianceNames.includes('computer') ? [{ title: 'Stop standby power', save: 120, desc: 'Use power strip for TV/Computer.' }] : []),
    ...(applianceNames.includes('pump') ? [{ title: 'Run pump at off-peak', save: 200, desc: 'Shift pump/microwave to morning.' }] : []),
    ...(applianceNames.includes('fan') ? [{ title: 'Use fans before AC', save: 150, desc: 'Use fans when comfortable to reduce AC runtime.' }] : []),
    ...(applianceNames.includes('refrigerator') || applianceNames.includes('fridge') ? [{ title: 'Check refrigerator seal', save: 100, desc: 'Keep the door seal clean and avoid frequent opening.' }] : [])
  ].sort((a, b) => b.save - a.save);
  $('#savingsList').innerHTML = (tips.length ? tips.map(tip =>
    `<div class="villain"><div><b>${tip.title}</b><br><small>${tip.desc}</small></div><b>+BDT ${tip.save}</b></div>`
  ).join('') : '<p class="muted">Add appliances to get usage-specific saving tips.</p>') + '<p class="disclaimer">Ranked by estimated monthly saving. Yearly estimate = monthly ×12.</p>';

  renderDonut(enriched);
  renderLine();
  renderSolar(totalKwh, price);
  renderReport(enriched, totalKwh, totalCost);
  renderHistoryTable();
  applyLang();
}

function renderDonut(data) {
  if (typeof Chart === 'undefined') return;
  if (donut) donut.destroy();
  donut = new Chart($('#donutChart'), {
    type: 'doughnut',
    data: {
      labels: data.length ? data.map(item => item.name) : ['No data'],
      datasets: [{
        data: data.length ? data.map(item => Math.round(item.cost)) : [1],
        backgroundColor: ['#A3E635', '#22D3EE', '#0B1120', '#94A3B8', '#F59E0B', '#EF4444'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '68%',
      animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderLine() {
  if (typeof Chart === 'undefined') return;
  const sortedBills = [...bills].sort((a, b) => a.month.localeCompare(b.month));
  if (line) line.destroy();
  line = new Chart($('#lineChart'), {
    type: 'line',
    data: {
      labels: sortedBills.length ? sortedBills.map(bill => bill.month) : ['No bills saved'],
      datasets: [{
        label: 'Bill BDT', data: sortedBills.length ? sortedBills.map(bill => bill.amount) : [0],
        tension: 0.4, borderColor: '#0B1120', backgroundColor: 'rgba(163,230,53,.2)', fill: true
      }]
    },
    options: {
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  const alertBox = $('#alertBox');
  if (sortedBills.length > 1) {
    const previous = sortedBills[sortedBills.length - 2].amount;
    const current = sortedBills[sortedBills.length - 1].amount;
    alertBox.innerHTML = previous > 0 && current > previous * 1.2
      ? `<p class="villain">${svgIcon('alert')} Your bill increased by more than 20% compared with the previous saved month.</p>`
      : '';
  } else {
    alertBox.innerHTML = '';
  }
}

function renderSolar(monthlyKwh, price) {
  const sunHours = Math.max(1, Number($('#sunHours')?.value) || 4.2);
  const performance = Math.min(1, Math.max(0.01, (Number($('#solarPerformance')?.value) || 75) / 100));
  const installedCostPerKw = Math.max(0, Number($('#costPerKw')?.value) || 85000);
  const offsetTarget = Math.min(1, Math.max(0.1, (Number($('#solarOffsetTarget')?.value) || 80) / 100));

  const systemKw = monthlyKwh
    ? (monthlyKwh * offsetTarget) / (sunHours * 30 * performance)
    : 0;

  const generation = systemKw * sunHours * 30 * performance;
  const offsetKwh = Math.min(monthlyKwh, generation);
  const saving = offsetKwh * price;

  const paybackYears = saving > 0
    ? (systemKw * installedCostPerKw) / (saving * 12)
    : 0;

  $('#solarKw').textContent = systemKw.toFixed(1) + ' kW';
  $('#solarGen').textContent = Math.round(generation) + ' kWh/mo';
  $('#solarSave').textContent = 'BDT ' + Math.round(saving) + '/mo';
  $('#solarPayback').textContent = saving > 0
    ? `Payback: ~${paybackYears.toFixed(1)} years`
    : 'Payback: —';

  $('#solarFill').style.width = (monthlyKwh
    ? Math.min(100, (offsetKwh / monthlyKwh) * 100)
    : 0) + '%';

  $('#solarExplain').textContent = monthlyKwh
    ? `Sized to offset about ${Math.round(offsetTarget * 100)}% of your monthly use `
      + `(≈${Math.round(offsetKwh)} of ${Math.round(monthlyKwh)} kWh). `
      + `Assumes ${sunHours} sun-hours/day and ${Math.round(performance * 100)}% performance. `
      + `Actual output, tariffs, and net-metering terms vary.`
    : 'Add appliances to estimate a rooftop solar system.';
}

function renderReport(data, totalKwh, totalCost) {
  const items = data.length
    ? data.map(item => `<li>${escapeHtml(item.name)} ×${item.qty}: ${item.kwh.toFixed(1)} kWh — BDT ${Math.round(item.cost)}</li>`).join('')
    : '<li>No appliances added yet.</li>';
  $('#reportBody').innerHTML = `<p>Estimated monthly use: <b>${totalKwh.toFixed(1)} kWh</b></p><p>Estimated appliance cost: <b>BDT ${Math.round(totalCost)}</b></p><ul>${items}</ul>`;
}

function exportCsv() {
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Month', 'Bill BDT', 'Units kWh', 'Price per unit BDT', 'Savings goal BDT'],
    ...bills.map(bill => [bill.month, bill.amount, bill.units, bill.price, bill.goal])];
  const csv = rows.map(row => row.map(quote).join(',')).join('\\r\\n');
  const url = URL.createObjectURL(new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'wattwise-bill-history.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function clearAllData() {
  const message = lang === 'bn'
    ? 'সব WattWise সংরক্ষিত বিল, যন্ত্রপাতি ও সেটিংস মুছে ফেলবেন?'
    : 'Delete all saved WattWise bills, appliances, and settings?';
  if (!window.confirm(message)) return;
  ['ww_appliances', 'ww_bills', 'ww_lang', 'ww_theme', 'ww_estimate_settings'].forEach(key => localStorage.removeItem(key));
  location.reload();
}

function renderHistoryTable() {
  const container = $('#historyTable');
  if (!bills.length) {
    container.innerHTML = '<p class="muted">No bills saved yet.</p>';
    return;
  }
  const rows = [...bills].reverse().map(bill =>
    `<tr><td>${escapeHtml(bill.month)}</td><td>BDT ${Number(bill.amount).toFixed(0)}</td><td>${Number(bill.units).toFixed(1)} kWh</td></tr>`
  ).join('');
  container.innerHTML = `<table><thead><tr><th>Month</th><th>Bill</th><th>Units</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function initScrollAnimations() {
  const groups = [
    '.app-hero', '#setup > h2', '#setup .grid2 > .card', '#dashboard > h2',
    '#dashboard .stats > .card', '#dashboard .grid2 > .card', '#solar.section.card',
    '#history .grid2 > .card', '#report'
  ];
  const elements = [];

  groups.forEach(selector => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.classList.add('scroll-reveal');
      element.style.setProperty('--motion-order', index);
      elements.push(element);
    });
  });

  if (!('IntersectionObserver' in window)) {
    elements.forEach(element => element.classList.add('in'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  elements.forEach(element => observer.observe(element));
}

/* ---------- EPIC PRELOADER CONTROLLER ---------- */
function initPreloader() {
  const preloader = $('#preloader');
  if (!preloader) return;

  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // On landing page the full show runs (~2.3s). On the app page we shorten it.
  const isApp = !!$('#applianceList');
  const HOLD_MS = prefersReduced ? 250 : (isApp ? 1600 : 2300);

  document.documentElement.style.overflow = 'hidden';

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    preloader.classList.add('hide');
    document.body.classList.add('pre-revealing');

    setTimeout(() => {
      document.body.classList.remove('pre-revealing');
      document.body.classList.add('pre-done');
      document.documentElement.style.overflow = '';
      preloader.setAttribute('aria-hidden', 'true');
      setTimeout(() => preloader.remove(), 900);
    }, prefersReduced ? 220 : 780);
  };

  const start = () => setTimeout(finish, HOLD_MS);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  setTimeout(() => {
    if (document.body.contains(preloader)) finish();
  }, HOLD_MS + 2500);
}

/* ---------- SCROLL PROGRESS BAR ---------- */
function initScrollProgress() {
  const bar = document.querySelector('#scroll-progress span');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const pct = height > 0 ? (scrollTop / height) * 100 : 0;
    bar.style.width = pct + '%';
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
}

/* ---------- MAGNETIC BUTTONS ---------- */
function initMagneticButtons() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(pointer: coarse)').matches) return; // skip touch devices
  document.querySelectorAll('.magnetic').forEach(button => {
    const strength = 8;
    button.addEventListener('mousemove', event => {
      const rect = button.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * strength;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * strength;
      button.style.transform = `translate(${x}px, ${y}px)`;
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = '';
    });
  });
}

/* ---------- HERO DONUT DRAW-IN ---------- */
function initHeroDonut() {
  const canvas = document.getElementById('heroDonut');
  if (!canvas || typeof Chart === 'undefined') return;
  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['AC', 'Fridge', 'Fans', 'Others'],
      datasets: [{
        data: [42, 18, 14, 26],
        backgroundColor: ['#A3E635', '#22D3EE', '#0B1120', '#94A3B8'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '72%',
      animation: { animateRotate: true, duration: 1400, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function renderLandingPage() {
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeToggles();

  const slider = $('#billSlider');
  if (slider) {
    const updateSolar = () => {
      const bill = Number(slider.value);
      const systemKw = bill / 3600;
      const yearlySavings = bill * 12 * 0.48;
      const payback = yearlySavings > 0 ? (systemKw * 85000) / yearlySavings : 0;
      $('#billVal').textContent = `BDT ${bill.toLocaleString()}`;
      $('#sKw').textContent = `${systemKw.toFixed(1)} kW`;
      $('#sSave').textContent = `BDT ${Math.round(yearlySavings).toLocaleString()}`;
      $('#sPay').textContent = payback > 0 ? `${payback.toFixed(1)} years` : '—';
    };
    slider.addEventListener('input', updateSolar);
    updateSolar();
  }

  const hamburger = $('#hamburger');
  hamburger?.addEventListener('click', () => $('#drawer')?.classList.toggle('open'));
  document.querySelectorAll('.faq-item button').forEach(button => {
    button.addEventListener('click', () => button.parentElement.classList.toggle('open'));
  });
  document.querySelectorAll('#drawer a').forEach(link => {
    link.addEventListener('click', () => $('#drawer')?.classList.remove('open'));
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        entry.target.querySelectorAll('[data-count]').forEach(counter => {
          const target = Number(counter.dataset.count);
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            counter.textContent = target;
            return;
          }
          const started = performance.now();
          const animateCount = now => {
            const progress = Math.min((now - started) / 900, 1);
            counter.textContent = Math.round(target * progress);
            if (progress < 1) requestAnimationFrame(animateCount);
          };
          requestAnimationFrame(animateCount);
        });
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach(element => element.classList.add('in'));
  }
  applyLang();
}

document.querySelectorAll('#langToggle, #langToggle2').forEach(button => {
  button.addEventListener('click', () => {
    lang = lang === 'en' ? 'bn' : 'en';
    localStorage.setItem('ww_lang', lang);
    if ($('#applianceList')) renderAll();
    else applyLang();
  });
});
document.querySelectorAll('#themeToggle, #themeToggle2').forEach(button => {
  button.addEventListener('click', () => {
    theme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('ww_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggles();
  });
});

initScrollAnimations();
initPreloader();
initScrollProgress();
initMagneticButtons();

const billImageInput = $('#billImage');
billImageInput?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  const preview = $('#billImagePreview');
  if (billImageUrl) URL.revokeObjectURL(billImageUrl);
  billImageUrl = null;
  preview.replaceChildren();
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    preview.textContent = 'Choose an image file.';
    return;
  }
  billImageUrl = URL.createObjectURL(file);
  const image = document.createElement('img');
  image.src = billImageUrl;
  image.alt = 'Bill image preview';
  preview.appendChild(image);
});

document.querySelectorAll('#slabLimit1, #slabLimit2, #slabRate1, #slabRate2, #slabRate3, #fixedCharge, #vatPercent, #seasonProfile, #sunHours, #solarPerformance, #costPerKw, #solarOffsetTarget, #pricePerUnit')
  .forEach(field => field.addEventListener('change', () => {
    persistEstimateSettings();
    if ($('#applianceList')) renderAll();
  }));

if ($('#applianceList')) {
  restoreEstimateSettings();
  if (!$('#billMonth').value) $('#billMonth').value = new Date().toISOString().slice(0, 7);
  renderAll();
} else {
  initHeroDonut();
  renderLandingPage();
}