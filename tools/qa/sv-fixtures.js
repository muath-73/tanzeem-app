// Real answers returned by the deployed `solve` function (Haiku 5.5) for tools/qa/solve-samples/*_photo.jpg, 20 Nov 2026.
window.__SVFIX = {
  long: [
    { ok: true, parts: [
      { title: 'Part 1: True or False', items: [
        { n: 'a', type: 'tf', answer: false, explain: 'تأثير السوط يزيد تقلب الطلب كلما تحركنا صعوداً في سلسلة الإمداد، ولا يقلله.' },
        { n: 'b', type: 'tf', answer: true, explain: 'مخزون الأمان يحمي من عدم التأكد في الطلب ووقت التوريد.' },
        { n: 'c', type: 'tf', answer: false, explain: 'نظام التوريد في الوقت المناسب يهدف إلى تقليل مستويات المخزون، لا إلى إبقائها مرتفعة.' },
        { n: 'd', type: 'tf', answer: false, explain: 'اللوجستيات الواردة تخص استلام المواد والمدخلات، أما تسليم المنتجات النهائية للعملاء فهو لوجستيات صادرة.' }] },
      { title: 'Part 2: Multiple Choice', items: [
        { n: '1', type: 'mcq', answer: 'b', explain: 'تكلفة الطلب تنخفض لكل وحدة عندما نطلب كمية أكبر لأن عدد مرات الطلب يقل.' },
        { n: '2', type: 'mcq', answer: 'b', explain: 'مزود الخدمات اللوجستية الخارجي (3PL) هو شركة تتولى تنفيذ جزء من العمليات اللوجستية للمنشأة بالتعاقد.' },
        { n: '3', type: 'mcq', answer: 'c', explain: 'نحسب كمية الطلب الاقتصادية بالقانون المعروف، والناتج 400 وحدة وهو الخيار (c).' }] },
      { title: 'Part 3: Problem', items: [
        { n: '4', type: 'work', steps: [{ note: 'نستخدم قانون نقطة إعادة الطلب: الطلب اليومي × وقت التوريد + مخزون الأمان.' }, { math: 'ROP = d \\times L + SS' }, { note: 'نعوض بالقيم: d = 50 وحدة/يوم، L = 6 أيام، SS = 100 وحدة.' }, { math: 'ROP = 50 \\times 6 + 100' }, { math: 'ROP = 300 + 100' }], answer: 'ROP = 400 \\text{ units}', explain: 'نقطة إعادة الطلب هي 400 وحدة.' }] }] },
    { ok: true, parts: [{ title: '', items: [
      { n: '1', type: 'work', steps: [{ note: 'نقسم المعادلة على 2 لتبسيطها' }, { math: 'x^{2} - 4x + 3 = 0' }, { note: 'نحلل المعادلة إلى عاملين' }, { math: '(x-1)(x-3) = 0' }], answer: 'x = 1 \\text{ or } x = 3', explain: 'حللنا المعادلة التربيعية بعد قسمتها على 2.' },
      { n: '2', type: 'work', steps: [{ note: 'نشتق كل حد باستخدام قاعدة القوة' }, { math: "f'(x) = 3 \\cdot 3x^{2} - 2 \\cdot 5x" }], answer: "f'(x) = 9x^{2} - 10x", explain: 'اشتقاق كل حد بقاعدة القوة، والثابت يختفي.' },
      { n: '3', type: 'work', steps: [{ math: '\\frac{x^{2} - 4}{x - 2} = \\frac{(x-2)(x+2)}{x-2}' }, { math: '\\lim_{x \\to 2} (x + 2)' }], answer: '4', explain: 'بعد الاختصار تصبح الدالة x+2 والنهاية عند 2 تساوي 4.' },
      { n: '4', type: 'work', steps: [{ math: '\\int_{0}^{2} (3x^{2} + 1)\\,dx = \\left[x^{3} + x\\right]_{0}^{2}' }, { math: '(8 + 2) - (0 + 0)' }], answer: '10', explain: 'أوجدنا الدالة الأصلية ثم عوضنا حدي التكامل.' },
      { n: '5', type: 'mcq', answer: 'C', explain: 'إذا كان log2(x) = 5 فإن x = 2^5 = 32.' }] }] }],
  short: [
    { ok: true, parts: [
      { title: 'Part 1: True or False', items: [{ n: 'a', type: 'tf', answer: false }, { n: 'b', type: 'tf', answer: true }, { n: 'c', type: 'tf', answer: false }, { n: 'd', type: 'tf', answer: false }] },
      { title: 'Part 2: Multiple Choice', items: [{ n: '1', type: 'mcq', answer: 'b' }, { n: '2', type: 'mcq', answer: 'b' }, { n: '3', type: 'mcq', answer: 'c' }] },
      { title: 'Part 3: Problem', items: [{ n: '4', type: 'work', steps: [{ math: 'ROP = d \\times L + SS' }, { math: 'ROP = 50 \\times 6 + 100' }, { math: 'ROP = 300 + 100' }], answer: '400' }] }] },
    { ok: true, parts: [{ title: 'Section A', items: [
      { n: '1', type: 'work', steps: [{ math: '\\text{Mean} = \\frac{4 + 8 + 6 + 10 + 12}{5}' }, { math: '\\text{Mean} = \\frac{40}{5}' }], answer: '8' },
      { n: '2', type: 'work', steps: [{ math: '\\text{Sorted: } 1, 3, 5, 7, 9, 11' }, { math: '\\text{Median} = \\frac{5 + 7}{2}' }], answer: '6' },
      { n: '3', type: 'work', steps: [{ math: 'P = \\frac{2}{6}' }], answer: '\\frac{1}{3}' }] },
      { title: 'Section B — Choose the correct answer', items: [{ n: '4', type: 'mcq', answer: 'iii' }, { n: '5', type: 'mcq', answer: 'iii' }] }] },
    { ok: true, parts: [{ title: '', items: [{ n: '1', type: 'mcq', answer: 'B' }, { n: '2', type: 'mcq', answer: 'C' }, { n: '3', type: 'work', steps: [{ math: 'CO = HR \\times SV' }, { math: 'CO = 70 \\times 80' }], answer: '5600\\ \\text{mL/min}' }, { n: '4', type: 'tf', answer: false }, { n: '5', type: 'text', answer: 'pulmonary' }] }] }]
};
