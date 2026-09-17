import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxtvvjijtraobzaqdevz.supabase.co';
const supabaseAnonKey = 'sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TASKS = [
  // LEVEL 1
  { id: 't01', level: 1, en: 'TP Bill Filing / Expense Filling', hi: 'TP बिल फाइल में लगाना/खर्चे की एंट्री करना', dept: 'EXCISE' },
  { id: 't02', level: 1, en: 'Rack Cleaning & Filling', hi: 'रैक की सफाई और माल भरना', dept: 'RETAIL', tag: 'Task' },
  { id: 't03', level: 1, en: 'Fridge Filling & Cleaning', hi: 'फ्रिज में बोतलें भरना और सफाई', dept: 'RETAIL' },
  { id: 't04', level: 1, en: 'UPI Payment Check', hi: 'UPI पेमेंट चेक करना', dept: 'RETAIL' },
  { id: 't05', level: 1, en: 'Age Check (25+ Customers)', hi: 'ग्राहक की उम्र चेक करना (25 साल से ऊपर)', dept: 'RETAIL', tag: 'Knowledge' },
  { id: 't06', level: 1, en: 'Regular MRP & Brand Knowledge', hi: 'MRP और ब्रांड की सामान्य जानकारी', dept: 'RETAIL', tag: 'Knowledge' },
  { id: 't07', level: 1, en: 'Fast Moving Item Knowledge', hi: 'ज्यादा बिकने वाले माल की जानकारी', dept: 'RETAIL', tag: 'Knowledge' },
  { id: 't08', level: 1, en: 'Deal with Customer Politely/ Feedback', hi: 'ग्राहकों से आराम से बात करना/फीडबैक', dept: 'RETAIL', tag: 'Knowledge' },
  { id: 't09', level: 1, en: 'Home Delivery', hi: 'होम डिलीवरी करना', dept: 'RETAIL', tag: 'Wholesale' },
  { id: 't10', level: 1, en: 'Shop & Bathroom Cleaning (3 times)', hi: 'दुकान और बाथरूम की सफाई (3 बार)', dept: 'RETAIL', tag: 'Task' },
  { id: 't11', level: 1, en: 'Snacks Counter Set & Sale', hi: 'स्नैक्स काउंटर सेट करना और बेचना', dept: 'SANCKS' },
  { id: 't12', level: 1, en: 'Ice Packing & SANCKS Expiry Check', hi: 'बर्फ पैक करना और SANCKS एक्सपायरी चेक करना', dept: 'SANCKS' },
  { id: 't13', level: 1, en: 'physical stock knowledge in APP', hi: '', dept: 'STOCKS' },
  { id: 't14', level: 1, en: 'wholesale STOCK REMOVING', hi: '', dept: 'WHOLESALE' },
  { id: 't15', level: 1, en: 'Google Form( IN OUT / CASH TALLY/ PETTY CASH/ SANCKS .ETC)', hi: 'गूगल फॉर्म भरना', dept: 'EXCISE' },
  { id: 't50', level: 1, en: 'Courier Bill to Office', hi: 'ऑफिस में बिल कूरियर करना', dept: 'EXCISE' },
  { id: 't51', level: 1, en: 'Shop Property Maintenance', hi: 'दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर A TO Z) का ध्यान रखना', dept: 'TECHNICAL' },

  // LEVEL 2
  { id: 't16', level: 2, en: 'Brandwise Printout', hi: 'ब्रांड के अनुसार प्रिंटआउट निकालना', dept: 'EXCISE' },
  { id: 't17', level: 2, en: 'PHYSICAL STOCK SANCK/ PURCHASE', hi: '', dept: 'SANCKS' },
  { id: 't18', level: 2, en: 'Expense/UPI/Slip/RECIPTS Updates', hi: 'कंप्यूटर में खर्चा/UPI/स्लिप अपडेट करना', dept: 'EXCISE' },
  { id: 't19', level: 2, en: 'Register Maintenance (IMFL/CL/MML)', hi: 'रजिस्टर (IMFL/CL/MML) भरना', dept: 'EXCISE' },
  { id: 't20', level: 2, en: 'TP Summary (IMFL + CL MML )', hi: 'TP समरी (IMFL + CL) तैयार करना', dept: 'EXCISE' },
  { id: 't21', level: 2, en: 'N-Computing Maintenance', hi: 'N-कंप्यूटिंग सिस्टम का रखरखाव', dept: 'TECHNICAL' },
  { id: 't22', level: 2, en: 'Fridge Bottle Breakage Record', hi: 'फ्रिज में बोतल टूटने का रिकॉर्ड रखना', dept: 'RETAIL' },
  { id: 't23', level: 2, en: 'Sale Point Hisaab', hi: 'सेल पॉइंट का हिसाब करना', dept: 'IMP RETAIL/RETAIL /SANCKS' },
  { id: 't24', level: 2, en: 'Offers & Gift Information', hi: 'ग्राहकों को गिफ्ट और ऑफर बताना', dept: 'RETAIL' },
  { id: 't25', level: 2, en: 'Up-selling & Cross-selling', hi: 'सेल बढ़ाने के लिए ग्राहकों को प्रेरित करना', dept: 'RETAIL' },
  { id: 't26', level: 2, en: 'Imported Brand MRP Knowledge', hi: 'इम्पोर्टेड ब्रांड्स के रेट की जानकारी', dept: 'IMP RETAIL/RETAIL /SANCKS' },
  { id: 't27', level: 2, en: 'Batchwise Stock Checking (TP)', hi: 'TP से बैच के अनुसार माल चेक करना', dept: 'STOCKS' },
  { id: 't28', level: 2, en: 'Damage BAEKGS Report', hi: 'डैमेज रिपोर्ट और गिफ्ट आइटम का रखरखाव', dept: 'RETAIL' },
  { id: 't29', level: 2, en: 'TRADER KA ORDER NIKLANA', hi: 'REGULAR STOCK ऑर्डर निकालना', dept: 'STOCKS' },
  { id: 't30', level: 2, en: 'Wholesale BILL CHECK KARNA / PAYMENTS', hi: 'होलसेल पार्टी की जरूरत और पैकिंग चेक करना', dept: 'WHOLESALE' },
  { id: 't31', level: 2, en: 'Home Delivery Record', hi: 'होम डिलीवरी का रिकॉर्ड रखना', dept: 'RETAIL' },
  { id: 't32', level: 2, en: 'SHORT STOCK ITEM LIST MAINTAIN BOOK', hi: '', dept: 'RETAIL' },
  { id: 't33', level: 2, en: 'REGULAR COUNTER KARNA', hi: '', dept: 'RETAIL' },
  { id: 't52', level: 2, en: 'BANK Slip Filling', hi: 'BANK स्लिप भरना', dept: 'RETAIL' },
  { id: 't53', level: 2, en: 'whole sale party discount knowledge', hi: '', dept: 'WHOLESALE' },
  { id: 't54', level: 2, en: 'Snacks Order & Vendor Knowledge', hi: 'स्नैक्स का ऑर्डर और वेंडर की जानकारी', dept: 'SANCKS' },
  { id: 't55', level: 2, en: 'Shop Property Maintenance', hi: 'दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर A TO Z) का ध्यान रखना', dept: 'TECHNICAL' },

  // LEVEL 3
  { id: 't34', level: 3, en: 'TP Purchase & Bill Highlighting', hi: 'TP खरीद, बिल चेक और हाईलाइट करना', dept: 'EXCISE' },
  { id: 't35', level: 3, en: 'Sale Posting', hi: 'सेल पोस्ट करना', dept: 'EXCISE' },
  { id: 't36', level: 3, en: 'Online SCM Filling', hi: 'ऑनलाइन SCM भरना', dept: 'EXCISE' },
  { id: 't37', level: 3, en: 'Daily Computer Backup', hi: 'कंप्यूटर का डेली बैकअप लेना', dept: 'EXCISE' },
  { id: 't38', level: 3, en: 'Cash Tally Report in Group', hi: 'ग्रुप में कैश टैली रिपोर्ट भेजना', dept: 'EXCISE' },
  { id: 't39', level: 3, en: 'Increasing Wholesale Sales', hi: 'होलसेल का काम बढ़ाना', dept: 'WHOLESALE' },
  { id: 't40', level: 3, en: 'PO SYSTEM ORDER NIKLAN PO ORDER ACCEPTS KARNA', hi: 'IMS और FMS सिस्टम मैनेज करना', dept: 'TECHNICAL' },
  { id: 't41', level: 3, en: 'Attendance &', hi: 'अटेंडेंस बुक अपडेट करना', dept: 'RETAIL' },
  { id: 't42', level: 3, en: 'Expense Book Maintenance', hi: 'खर्चे वाली बुक को सही से मेंटेन करना', dept: 'RETAIL' },
  { id: 't43', level: 3, en: 'Shop Property Maintenance', hi: 'दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर) का ध्यान रखना', dept: 'TECHNICAL' },

  // LEVEL 4
  { id: 't44', level: 4, en: 'IMPORETD BRAND ORDER NIKLANA', hi: '', dept: 'IMP RETAIL/RETAIL /SANCKS' },
  { id: 't45', level: 4, en: 'STAFF Training System', hi: 'STAFF ट्रेनिंग देना', dept: 'TECHNICAL' },
  { id: 't46', level: 4, en: 'Theft Prevention', hi: 'चोरी रोकना (Thrift Prevention)', dept: 'TECHNICAL' },
  { id: 't47', level: 4, en: 'Shutter Lock (Open/Close)', hi: 'दुकान के शटर खोलना और बंद करना', dept: 'TECHNICAL' },
  { id: 't48', level: 4, en: 'Fire Safety & CCTV Checking', hi: 'फायर सेफ्टी और CCTV की चेकिंग', dept: 'TECHNICAL' },
  { id: 't49', level: 4, en: 'Staff Management', hi: 'पूरे स्टाफ का मैनेजमेंट', dept: 'TECHNICAL' },
  { id: 't56', level: 4, en: 'License & Legal Books (Excise)', hi: 'एक्साइज रजिस्टर, शॉप एक्ट और जरूरी दस्तावेज संभालना', dept: 'EXCISE' },
  { id: 't57', level: 4, en: 'Shop Property Maintenance', hi: 'दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर A TO Z) का ध्यान रखना', dept: 'TECHNICAL' },
  { id: 't58', level: 4, en: 'Level Up Boys', hi: 'लड़कों का लेवल बढ़ाना', dept: 'TECHNICAL' },
  { id: 't59', level: 4, en: 'TASK COMPLETE KARWANA', hi: '', dept: 'TECHNICAL' },
  { id: 't60', level: 4, en: 'CASH HANDLING', hi: '', dept: 'RETAIL' }
];

async function seed() {
  console.log('Starting seed process for hr_learning_tasks...');
  const payload = TASKS.map(t => ({
    id: t.id,
    level: t.level,
    dept: t.dept,
    task_en: t.en,
    task_hi: t.hi || null,
    tag: t.tag || null
  }));

  const { data, error } = await supabase
    .from('hr_learning_tasks')
    .upsert(payload, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('Seeding error:', error);
  } else {
    console.log('SUCCESS! Populated', data ? data.length : 0, 'tasks into Supabase table: hr_learning_tasks');
  }
}

seed();
