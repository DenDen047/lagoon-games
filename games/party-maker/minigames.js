/* =========================================================================
   PARTY MAKER ― ミニゲーム6種
   どれも「出題者が用意する → 残りの人が順番に答える」形。
   run(ctx) が画面を作り、終わったら ctx.finish(結果) を呼ぶ。

   結果 = { headline, body(表示する要素/なくてもいい), deltas(人数ぶんの得点) }
   ========================================================================= */
'use strict';

/* 出題者の次の人から順に、出題者を除いた並び */
function answerOrder(ctx) {
  const n = ctx.players.length;
  const out = [];
  for (let i = 1; i <= n; i++) {
    const idx = (ctx.hostIndex + i) % n;
    if (idx !== ctx.hostIndex) out.push(idx);
  }
  return out;
}

/* 出題者の次の人から順に、全員 */
function fullOrder(ctx) {
  const n = ctx.players.length;
  const out = [];
  for (let i = 1; i <= n; i++) out.push((ctx.hostIndex + i) % n);
  return out;
}

function zeros(ctx) { return ctx.players.map(() => 0); }

/* はずれた答えの一覧。出題者は ✓ を押して手で正解にできる。 */
function missList(misses, onRescue, hostName) {
  if (misses.length === 0) return null;
  return el('div', 'misses', [
    el('p', { class: 'misses-head', text: 'はずれた答え（' + hostName + 'さんは ✓ で正解にできます）' }),
    el('div', 'miss-chips', misses.map((m, i) => el('span', 'miss-chip', [
      nameTag(m.player, 'mini'),
      el('b', { text: m.text }),
      el('button', { class: 'rescue', type: 'button', title: '正解にする', onClick: () => onRescue(i) }, '✓'),
    ]))),
  ]);
}

/* =========================================================================
   1. おえかきクイズ
   描いた人が答えを決め、その答えを打った人が勝ち。
   ========================================================================= */
const MG_DRAW = {
  id: 'draw',
  name: 'おえかきクイズ',
  icon: '🎨',
  tag: '絵',
  desc: '出題者が絵を描き、答えを決める。その答えを打てた人の勝ち。',
  rule: '当てた人 +3 / 出題者は誰かが当てたら +2',
  minPlayers: 2,
  run(ctx) {
    let answer = '';
    let image = null;
    let last = null;
    const misses = [];

    handoff(ctx.host, 'お題は出題者だけの秘密です。', setAnswer);

    /* --- 答えを決める --- */
    function setAnswer() {
      const box = secretInput('例：たこやき');
      const hint = el('p', 'sub-note', '思いつかないときは「お題をもらう」を押してください。');
      const go = () => {
        const v = box.input.value.trim();
        if (!v) { toast('お題を入れてください'); return; }
        answer = v;
        drawPhase();
      };
      onEnter(box.input, go);
      show(panel({
        eyebrow: '🎨 おえかきクイズ',
        title: ctx.host.name + 'さん、お題を決めてください',
        lead: 'ここで決めた言葉が正解になります。ほかの人がこの言葉を打てたら、その人の勝ちです。',
        body: el('div', 'form', [
          box, hint,
          el('div', 'row', [
            btn('お題をもらう', () => {
              last = pickWord(DRAW_WORDS, last);
              box.input.value = last;
              box.input.type = 'text';
              setTimeout(() => { box.input.type = 'password'; }, 1200);
            }, 'ghost'),
          ]),
        ]),
        foot: btn('この言葉でいく', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    /* --- 描く --- */
    function drawPhase() {
      const paint = new Paint();
      let timer = null;
      const done = () => {
        if (timer) timer.stop();
        image = paint.toDataURL();
        askPhase(0);
      };
      timer = countdown(90, done);
      show(panel({
        eyebrow: '🎨 おえかきクイズ',
        title: ctx.host.name + 'さんが描いています',
        lead: '字は書かないこと。90秒でしめきります。',
        body: el('div', 'paint-area', [
          el('div', 'paint-top', [timer, btn('描けた！', done, 'primary')]),
          paint.node,
        ]),
      }));
    }

    /* --- 順番に当てる --- */
    function askPhase(turn) {
      const order = answerOrder(ctx);
      if (turn >= order.length) { result(-1); return; }
      const who = ctx.players[order[turn]];
      const box = textInput('答えだと思う言葉');
      const go = () => {
        const v = box.input.value.trim();
        if (!v) { toast('なにか打ってください'); return; }
        if (sameWord(v, answer)) { result(order[turn]); return; }
        misses.push({ player: who, text: v, index: order[turn] });
        askPhase(turn + 1);
      };
      onEnter(box.input, go);

      show(panel({
        eyebrow: '🎨 おえかきクイズ　のこり ' + (order.length - turn) + '人',
        title: '',
        body: el('div', 'guess-area', [
          drawingView(image),
          missList(misses, (i) => result(misses[i].index), ctx.host.name),
          el('div', 'turn-line', [nameTag(who), el('span', { text: 'さんの番' })]),
          box,
        ]),
        foot: btn('こたえる', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    /* --- 結果 --- */
    function result(winner) {
      const d = zeros(ctx);
      if (winner >= 0) { d[winner] += 3; d[ctx.hostIndex] += 2; }
      ctx.finish({
        headline: winner >= 0
          ? ctx.players[winner].name + 'さんが当てた！'
          : 'だれも当てられなかった…',
        body: el('div', 'reveal', [
          drawingView(image, 'small'),
          el('p', 'reveal-answer', ['正解は ', el('b', { text: answer })]),
        ]),
        deltas: d,
      });
    }
  },
};

/* =========================================================================
   2. てづくりクイズ（4択）
   ========================================================================= */
const MG_QUIZ = {
  id: 'quiz',
  name: 'てづくりクイズ',
  icon: '❓',
  tag: 'クイズ',
  desc: '出題者が問題と選択肢を書く。ほかの人は伏せたまま順番に選ぶ。',
  rule: '正解 +2 / 出題者は正解者が1人以上、かつ全員正解でないとき +2',
  minPlayers: 2,
  run(ctx) {
    let question = '';
    let choices = [];
    let correct = 0;
    const picks = {};

    handoff(ctx.host, '問題は出題者だけの秘密です。', make);

    function make() {
      const q = el('textarea', { class: 'tarea', rows: 2, placeholder: '例：この中でいちばん足が速い動物は？' });
      const inputs = [];
      const rows = [0, 1, 2, 3].map((i) => {
        const radio = el('input', { type: 'radio', name: 'mgq', value: i, id: 'mgq' + i });
        if (i === 0) radio.checked = true;
        const inp = el('input', { class: 'tin', type: 'text', placeholder: '選択肢' + (i + 1), autocomplete: 'off' });
        inputs.push({ radio, inp });
        return el('label', 'choice-row', [radio, inp, el('span', 'choice-mark', 'これが正解')]);
      });

      const go = () => {
        question = q.value.trim();
        const list = [];
        let mark = -1;
        inputs.forEach((r) => {
          const v = r.inp.value.trim();
          if (!v) return;
          if (r.radio.checked) mark = list.length;
          list.push(v);
        });
        if (!question) { toast('問題文を入れてください'); return; }
        if (list.length < 2) { toast('選択肢は2つ以上いります'); return; }
        if (mark < 0) { toast('正解に選んだ欄が空です'); return; }
        choices = list; correct = mark;
        askPhase(0);
      };

      show(panel({
        eyebrow: '❓ てづくりクイズ',
        title: ctx.host.name + 'さん、問題を作ってください',
        lead: '選択肢は2〜4つ。左の丸を押して正解を決めます。全員が当てても、全員が外しても出題者に点は入りません。',
        body: el('div', 'form', [q, el('div', 'choices', rows)]),
        foot: btn('この問題でいく', go, 'big primary'),
      }));
      focusSoon(q);
    }

    function askPhase(turn) {
      const order = answerOrder(ctx);
      if (turn >= order.length) { reveal(); return; }
      const idx = order[turn];
      handoff(ctx.players[idx], 'ほかの人に選んだものが見えないようにしてください。', () => {
        show(panel({
          eyebrow: '❓ てづくりクイズ　のこり ' + (order.length - turn) + '人',
          title: question,
          body: el('div', 'choice-btns', choices.map((c, i) => btn(c, () => {
            picks[idx] = i;
            askPhase(turn + 1);
          }, 'choice big'))),
          foot: el('p', { class: 'sub-note', text: '押すとすぐ次の人に回ります。' }),
        }));
      });
    }

    function reveal() {
      const d = zeros(ctx);
      const order = answerOrder(ctx);
      let hits = 0;
      order.forEach((i) => { if (picks[i] === correct) { d[i] += 2; hits++; } });
      if (hits >= 1 && hits < order.length) d[ctx.hostIndex] += 2;

      ctx.finish({
        headline: hits === 0 ? 'だれも当てられなかった…'
          : hits === order.length ? '全員正解！ かんたんすぎたかも'
          : hits + '人が正解！',
        body: el('div', 'reveal', [
          el('p', 'reveal-q', question),
          el('div', 'reveal-choices', choices.map((c, i) => el('div', {
            class: 'reveal-choice' + (i === correct ? ' right' : ''),
          }, [
            el('b', { text: c }),
            el('span', 'who', order.filter((p) => picks[p] === i).map((p) => nameTag(ctx.players[p], 'mini'))),
          ]))),
        ]),
        deltas: d,
      });
    }
  },
};

/* =========================================================================
   3. 3ヒントクイズ
   ========================================================================= */
const MG_HINT = {
  id: 'hint',
  name: '3ヒントクイズ',
  icon: '💡',
  tag: 'クイズ',
  desc: '出題者が答えとヒント3つを用意。早い段階で当てるほど高い点。',
  rule: '1つ目で +5 / 2つ目で +4 / 3つ目で +3 / 出題者は誰かが当てたら +2',
  minPlayers: 2,
  run(ctx) {
    let answer = '';
    const hints = [];
    const misses = [];
    let level = 0;

    handoff(ctx.host, '答えは出題者だけの秘密です。', make);

    function make() {
      const ans = secretInput('答えになる言葉');
      const hs = [0, 1, 2].map((i) => el('input', {
        class: 'tin', type: 'text', autocomplete: 'off',
        placeholder: (i + 1) + 'つ目のヒント' + (i === 0 ? '（むずかしめ）' : i === 2 ? '（やさしめ）' : ''),
      }));
      const go = () => {
        answer = ans.input.value.trim();
        hints.length = 0;
        hs.forEach((h) => { const v = h.value.trim(); if (v) hints.push(v); });
        if (!answer) { toast('答えを入れてください'); return; }
        if (hints.length < 1) { toast('ヒントを1つ以上ください'); return; }
        round(0, 0);
      };
      show(panel({
        eyebrow: '💡 3ヒントクイズ',
        title: ctx.host.name + 'さん、答えとヒントを用意してください',
        lead: 'ヒントは上から順に公開されます。だんだんやさしくすると盛り上がります。',
        body: el('div', 'form', [ans, el('div', 'hint-fields', hs)]),
        foot: btn('この問題でいく', go, 'big primary'),
      }));
      focusSoon(ans.input);
    }

    function round(lv, turn) {
      level = lv;
      const order = answerOrder(ctx);
      if (turn >= order.length) {
        if (lv + 1 < hints.length) { round(lv + 1, 0); return; }
        result(-1);
        return;
      }
      const idx = order[turn];
      const who = ctx.players[idx];
      const box = textInput('答えだと思う言葉');
      const go = () => {
        const v = box.input.value.trim();
        if (!v) { toast('なにか打ってください'); return; }
        if (sameWord(v, answer)) { result(idx); return; }
        misses.push({ player: who, text: v, index: idx });
        round(lv, turn + 1);
      };
      onEnter(box.input, go);

      show(panel({
        eyebrow: '💡 3ヒントクイズ　ヒント ' + (lv + 1) + '／' + hints.length + '　このヒントで当てると +' + (5 - lv),
        title: '',
        body: el('div', 'guess-area', [
          el('ol', 'hint-list', hints.slice(0, lv + 1).map((h, i) => el('li', { text: h, class: i === lv ? 'fresh' : '' }))),
          missList(misses, (i) => result(misses[i].index), ctx.host.name),
          el('div', 'turn-line', [nameTag(who), el('span', { text: 'さんの番' })]),
          box,
        ]),
        foot: btn('こたえる', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    function result(winner) {
      const d = zeros(ctx);
      if (winner >= 0) { d[winner] += 5 - level; d[ctx.hostIndex] += 2; }
      ctx.finish({
        headline: winner >= 0
          ? ctx.players[winner].name + 'さんがヒント' + (level + 1) + 'で正解！'
          : 'だれも当てられなかった…',
        body: el('div', 'reveal', [
          el('p', 'reveal-answer', ['正解は ', el('b', { text: answer })]),
          el('ol', 'hint-list', hints.map((h) => el('li', { text: h }))),
        ]),
        deltas: d,
      });
    }
  },
};

/* =========================================================================
   4. かずあて
   ========================================================================= */
const MG_NUMBER = {
  id: 'number',
  name: 'かずあて',
  icon: '🔢',
  tag: '数',
  desc: '出題者が 1〜100 の数を隠す。順番に予想し、いちばん近い人が勝ち。',
  rule: 'ぴったり +5 / いちばん近い人 +3 / 出題者 +1',
  minPlayers: 2,
  run(ctx) {
    let secret = 0;
    const guesses = [];

    handoff(ctx.host, '数字は出題者だけの秘密です。', make);

    function make() {
      const box = secretInput('1〜100 の数');
      box.input.setAttribute('inputmode', 'numeric');
      const go = () => {
        const v = Math.round(Number(box.input.value));
        if (!(v >= 1 && v <= 100)) { toast('1〜100 の数を入れてください'); return; }
        secret = v;
        askPhase(0);
      };
      onEnter(box.input, go);
      show(panel({
        eyebrow: '🔢 かずあて',
        title: ctx.host.name + 'さん、1〜100 の数をひとつ',
        lead: '答えるたびに「あつい・つめたい」だけが出ます。ぴったり当てられたらそこで終わりです。',
        body: el('div', 'form', [
          box,
          el('div', 'row', [btn('おまかせ', () => {
            box.input.value = String(1 + Math.floor(Math.random() * 100));
          }, 'ghost')]),
        ]),
        foot: btn('この数でいく', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    function heat(diff) {
      if (diff === 0) return 'ぴったり！';
      if (diff <= 3) return 'めちゃくちゃアツい';
      if (diff <= 8) return 'アツい';
      if (diff <= 16) return 'あたたかい';
      if (diff <= 30) return 'ぬるい';
      return 'つめたい';
    }

    function askPhase(turn) {
      const order = answerOrder(ctx);
      if (turn >= order.length) { result(); return; }
      const idx = order[turn];
      const who = ctx.players[idx];
      const box = textInput('1〜100');
      box.input.setAttribute('inputmode', 'numeric');
      const go = () => {
        const v = Math.round(Number(box.input.value));
        if (!(v >= 1 && v <= 100)) { toast('1〜100 の数を入れてください'); return; }
        const diff = Math.abs(v - secret);
        guesses.push({ index: idx, player: who, value: v, diff: diff });
        if (diff === 0) { result(); return; }
        askPhase(turn + 1);
      };
      onEnter(box.input, go);

      show(panel({
        eyebrow: '🔢 かずあて　のこり ' + (order.length - turn) + '人',
        title: '',
        body: el('div', 'guess-area', [
          el('div', 'guess-log', guesses.map((g) => el('div', 'guess-row', [
            nameTag(g.player, 'mini'),
            el('b', { text: String(g.value) }),
            el('span', { class: 'heat h' + Math.min(4, Math.floor(g.diff / 8)), text: heat(g.diff) }),
          ]))),
          el('div', 'turn-line', [nameTag(who), el('span', { text: 'さんの番' })]),
          box,
        ]),
        foot: btn('こたえる', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    function result() {
      const d = zeros(ctx);
      d[ctx.hostIndex] += 1;
      let best = Infinity;
      guesses.forEach((g) => { if (g.diff < best) best = g.diff; });
      const winners = guesses.filter((g) => g.diff === best);
      winners.forEach((g) => { d[g.index] += best === 0 ? 5 : 3; });

      ctx.finish({
        headline: best === 0
          ? winners.map((w) => w.player.name).join('・') + 'さんがぴったり！'
          : winners.map((w) => w.player.name).join('・') + 'さんがいちばん近い（' + best + 'ちがい）',
        body: el('div', 'reveal', [
          el('p', 'reveal-answer', ['答えは ', el('b', { text: String(secret) })]),
          el('div', 'guess-log', guesses.map((g) => el('div', 'guess-row', [
            nameTag(g.player, 'mini'),
            el('b', { text: String(g.value) }),
            el('span', { class: 'heat', text: (g.diff === 0 ? 'ぴったり' : g.diff + 'ちがい') }),
          ]))),
        ]),
        deltas: d,
      });
    }
  },
};

/* =========================================================================
   5. れんそうゲーム
   ========================================================================= */
const MG_ASSOC = {
  id: 'assoc',
  name: 'れんそうゲーム',
  icon: '💭',
  tag: '言葉',
  desc: '出題者がお題を出し、全員が思いついた言葉をひとつ。同じ言葉どうしが得点。',
  rule: '同じ言葉を書いた人それぞれ +2 / 出題者 +1（出題者も答えます）',
  minPlayers: 2,
  run(ctx) {
    let topic = '';
    const words = {};
    let last = null;

    handoff(ctx.host, 'お題はこのあと全員に見せます。', make);

    function make() {
      const box = textInput('例：あかいもの');
      const go = () => {
        const v = box.input.value.trim();
        if (!v) { toast('お題を入れてください'); return; }
        topic = v;
        askPhase(0);
      };
      onEnter(box.input, go);
      show(panel({
        eyebrow: '💭 れんそうゲーム',
        title: ctx.host.name + 'さん、お題を決めてください',
        lead: 'ねらいは「ほかの人とかぶること」です。出題者も答えに参加します。',
        body: el('div', 'form', [
          box,
          el('div', 'row', [btn('お題をもらう', () => {
            last = pickWord(ASSOC_TOPICS, last);
            box.input.value = last;
          }, 'ghost')]),
        ]),
        foot: btn('このお題でいく', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    function askPhase(turn) {
      const order = fullOrder(ctx);
      if (turn >= order.length) { reveal(); return; }
      const idx = order[turn];
      handoff(ctx.players[idx], '書いた言葉は最後にまとめて見せます。', () => {
        const box = secretInput('思いついた言葉');
        const go = () => {
          const v = box.input.value.trim();
          if (!v) { toast('なにか打ってください'); return; }
          words[idx] = v;
          askPhase(turn + 1);
        };
        onEnter(box.input, go);
        show(panel({
          eyebrow: '💭 れんそうゲーム　のこり ' + (order.length - turn) + '人',
          title: topic,
          lead: 'といえば？',
          body: el('div', 'form', [box]),
          foot: btn('きめた', go, 'big primary'),
        }));
        focusSoon(box.input);
      });
    }

    function reveal() {
      const d = zeros(ctx);
      const order = fullOrder(ctx);
      const groups = [];
      order.forEach((i) => {
        const g = groups.find((x) => sameWord(x.key, words[i]));
        if (g) g.members.push(i);
        else groups.push({ key: words[i], members: [i] });
      });
      let matched = 0;
      groups.forEach((g) => {
        if (g.members.length >= 2) { g.members.forEach((i) => { d[i] += 2; }); matched += g.members.length; }
      });
      d[ctx.hostIndex] += 1;

      ctx.finish({
        headline: matched === 0 ? 'ひとつもかぶらなかった！' : matched + '人ぶんがかぶった',
        body: el('div', 'reveal', [
          el('p', 'reveal-q', topic + '　といえば'),
          el('div', 'assoc-groups', groups.map((g) => el('div', {
            class: 'assoc-group' + (g.members.length >= 2 ? ' hit' : ''),
          }, [
            el('b', { text: g.key }),
            el('span', 'who', g.members.map((i) => nameTag(ctx.players[i], 'mini'))),
            g.members.length >= 2 ? el('span', { class: 'plus', text: '+2' }) : null,
          ]))),
        ]),
        deltas: d,
      });
    }
  },
};

/* =========================================================================
   6. でんごんおえかき（3人以上）
   お題 → 絵 → 言葉 → 絵 → … と伝えていって、最後まで残るか見る。
   ========================================================================= */
const MG_TELEPHONE = {
  id: 'telephone',
  name: 'でんごんおえかき',
  icon: '📨',
  tag: '絵',
  desc: 'お題を絵にして次の人へ。次の人は絵だけ見て言葉にする。最後まで伝われば全員に点。',
  rule: '最後の言葉が最初のお題と同じなら全員 +3 / ちがっても全員 +1',
  minPlayers: 3,
  run(ctx) {
    /* chain[0] は出題者のお題。以降 draw / word が交互に並ぶ。 */
    const chain = [];
    let steps = [];

    handoff(ctx.host, '最初のお題は出題者だけの秘密です。', make);

    function make() {
      const box = secretInput('例：ゆきだるま');
      let last = null;
      const go = () => {
        const v = box.input.value.trim();
        if (!v) { toast('お題を入れてください'); return; }
        chain.push({ kind: 'word', by: ctx.hostIndex, value: v });
        buildSteps();
        step(0);
      };
      onEnter(box.input, go);
      show(panel({
        eyebrow: '📨 でんごんおえかき',
        title: ctx.host.name + 'さん、最初のお題を決めてください',
        lead: 'この言葉が次の人に見せられ、絵になって回っていきます。',
        body: el('div', 'form', [
          box,
          el('div', 'row', [btn('お題をもらう', () => {
            last = pickWord(DRAW_WORDS, last);
            box.input.value = last;
            box.input.type = 'text';
            setTimeout(() => { box.input.type = 'password'; }, 1200);
          }, 'ghost')]),
        ]),
        foot: btn('このお題でいく', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    /* 出題者以外が1回ずつ担当する。最後が「絵」で終わると答え合わせが
       できないので、その場合だけ先頭の人がもう一度だけ言葉を担当する。 */
    function buildSteps() {
      const order = answerOrder(ctx);
      steps = order.map((idx, i) => ({ by: idx, kind: i % 2 === 0 ? 'draw' : 'word' }));
      if (steps[steps.length - 1].kind === 'draw') {
        steps.push({ by: order[0], kind: 'word' });
      }
    }

    function step(i) {
      if (i >= steps.length) { reveal(); return; }
      const s = steps[i];
      const who = ctx.players[s.by];
      const prev = chain[chain.length - 1];
      handoff(who, i === 0 ? 'お題を受け取ってください。' : '前の人の分だけを見て、次へ渡します。', () => {
        if (s.kind === 'draw') drawStep(i, who, prev);
        else wordStep(i, who, prev);
      });
    }

    function drawStep(i, who, prev) {
      const paint = new Paint();
      let timer = null;
      const done = () => {
        if (timer) timer.stop();
        chain.push({ kind: 'draw', by: who.index, value: paint.toDataURL() });
        step(i + 1);
      };
      timer = countdown(60, done);
      show(panel({
        eyebrow: '📨 でんごんおえかき　' + (i + 1) + '／' + steps.length,
        title: who.name + 'さん、この言葉を絵にしてください',
        body: el('div', 'paint-area', [
          el('div', 'telephone-word', prev.value),
          el('div', 'paint-top', [timer, btn('描けた！', done, 'primary')]),
          paint.node,
        ]),
      }));
    }

    function wordStep(i, who, prev) {
      const box = secretInput('この絵は何？');
      const go = () => {
        const v = box.input.value.trim();
        if (!v) { toast('なにか打ってください'); return; }
        chain.push({ kind: 'word', by: who.index, value: v });
        step(i + 1);
      };
      onEnter(box.input, go);
      show(panel({
        eyebrow: '📨 でんごんおえかき　' + (i + 1) + '／' + steps.length,
        title: who.name + 'さん、この絵を言葉にしてください',
        body: el('div', 'guess-area', [drawingView(prev.value), box]),
        foot: btn('つぎへ渡す', go, 'big primary'),
      }));
      focusSoon(box.input);
    }

    function reveal() {
      const first = chain[0].value;
      const lastWord = chain[chain.length - 1].value;
      const ok = sameWord(first, lastWord);
      const d = ctx.players.map(() => (ok ? 3 : 1));

      ctx.finish({
        headline: ok ? '最後まで伝わった！' : '「' + first + '」が「' + lastWord + '」になりました',
        body: el('div', 'chain', chain.map((c, i) => el('div', 'chain-item', [
          el('span', { class: 'chain-by', text: ctx.players[c.by].name + (i === 0 ? '（お題）' : '') }),
          c.kind === 'draw' ? drawingView(c.value, 'small') : el('div', 'chain-word', c.value),
        ]))),
        deltas: d,
      });
    }
  },
};

const MINIGAMES = [MG_DRAW, MG_QUIZ, MG_HINT, MG_NUMBER, MG_ASSOC, MG_TELEPHONE];
const MG_BY_ID = {};
MINIGAMES.forEach((m) => { MG_BY_ID[m.id] = m; });
