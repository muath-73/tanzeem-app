// renders realistic university worksheets, then photo-like versions are made in python
const { chromium } = require('playwright');
const css = `body{font-family:'Times New Roman',serif;font-size:19px;width:800px;padding:50px 60px;color:#111;background:#fff}
h2{text-align:center;margin:0 0 4px;font-size:22px}.sub{text-align:center;margin-bottom:22px}h3{margin:22px 0 8px;font-size:19px;text-decoration:underline}
ol{padding-left:26px}li{margin:10px 0}.op{margin-left:18px}`;
const sheets = {
  scm: `<h2>King Fahd University — MGT 311 Supply Chain Management</h2><div class="sub">Worksheet 4 &nbsp;|&nbsp; Name: ____________ &nbsp; ID: ________</div>
<h3>Part 1: True or False</h3><ol type="a">
<li>The bullwhip effect reduces demand variability as we move up the supply chain. ______</li>
<li>Safety stock protects against uncertainty in demand and lead time. ______</li>
<li>Just-in-time (JIT) systems aim to keep inventory levels high. ______</li>
<li>Inbound logistics refers to delivering finished products to customers. ______</li></ol>
<h3>Part 2: Multiple Choice</h3><ol>
<li>Which cost decreases when the order quantity increases?<div class="op">(a) holding cost &nbsp; (b) ordering cost &nbsp; (c) unit price &nbsp; (d) shortage cost</div></li>
<li>A 3PL provider is best described as:<div class="op">(a) a raw-material supplier (b) an outsourced logistics company (c) a retailer (d) a bank</div></li>
<li>Annual demand D = 2000 units, ordering cost S = 40 SAR, holding cost H = 1 SAR/unit/year. The EOQ is:<div class="op">(a) 200 &nbsp; (b) 283 &nbsp; (c) 400 &nbsp; (d) 800</div></li></ol>
<h3>Part 3: Problem</h3><ol start="4"><li>Daily demand is 50 units, lead time is 6 days and safety stock is 100 units. Find the reorder point (ROP).</li></ol>`,
  math: `<h2>MATH 101 — Calculus I</h2><div class="sub">Quiz 3 &nbsp; (Show your work)</div><ol>
<li>Solve for x: &nbsp; 2x² − 8x + 6 = 0</li>
<li>Find f′(x) if f(x) = 3x³ − 5x² + 7</li>
<li>Evaluate the limit: &nbsp; lim<sub>x→2</sub> (x² − 4)/(x − 2)</li>
<li>Evaluate: &nbsp; ∫<sub>0</sub><sup>2</sup> (3x² + 1) dx</li>
<li>If log₂(x) = 5, then x = ?<div class="op">A) 10 &nbsp; B) 25 &nbsp; C) 32 &nbsp; D) 64</div></li></ol>`,
  stat: `<h2>STAT 201 — Introduction to Statistics</h2><div class="sub">Homework 2</div>
<h3>Section A</h3><ol>
<li>Find the mean of: 4, 8, 6, 10, 12</li>
<li>Find the median of: 7, 3, 9, 1, 5, 11</li>
<li>A fair die is rolled once. What is the probability of getting a number greater than 4?</li></ol>
<h3>Section B — Choose the correct answer</h3><ol start="4">
<li>Which measure is most affected by outliers?<div class="op">i) median &nbsp; ii) mode &nbsp; iii) mean &nbsp; iv) IQR</div></li>
<li>If P(A) = 0.3 and A and B are mutually exclusive with P(B) = 0.5, then P(A or B) =<div class="op">i) 0.15 &nbsp; ii) 0.65 &nbsp; iii) 0.8 &nbsp; iv) 0.2</div></li></ol>`,
  med: `<h2>Physiology 210 — Cardiovascular System</h2><div class="sub">Review sheet</div><ol>
<li>Cardiac output equals:<div class="op">A. HR + SV &nbsp; B. HR × SV &nbsp; C. SV ÷ HR &nbsp; D. BP × HR</div></li>
<li>The pacemaker of the heart is the:<div class="op">A. AV node &nbsp; B. Bundle of His &nbsp; C. SA node &nbsp; D. Purkinje fibers</div></li>
<li>Calculate cardiac output when HR = 70 bpm and SV = 80 mL. ____________</li>
<li>True or False: The left ventricle pumps blood into the pulmonary trunk. ______</li>
<li>Fill in the blank: Oxygenated blood returns to the heart through the ____________ veins.</li></ol>`,
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 920, height: 1200 }, deviceScaleFactor: 1.5 });
  for (const [k, h] of Object.entries(sheets)) { await p.setContent(`<style>${css}</style>${h}`); await p.screenshot({ path: `${k}.png`, fullPage: true }); }
  await b.close();
})();
