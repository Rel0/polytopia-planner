// Polytopia Planner – instant damage calculator on /damage-calculator/ (uses js/data.js + js/engine.js, no screenshot).
// Edge over other calculators: the defender's terrain AND whether its tribe has the tech for that bonus – the result
// is shown with and without the bonus, so you see at once if it survives because of it. Several attackers, best order.
(function (PP) {
  'use strict';
  const E = PP.engine, U = PP.UNITS, root = document.getElementById('calc');
  if (!root || !E || !U) return;
  const KIND = { none: ['Field / none', 1, null], forest: ['🌲 Forest', 1.5, 'Archery'], mountain: ['⛰️ Mountain', 1.5, 'Climbing'], water: ['🌊 Water / ocean', 1.5, 'Aquatism'], city: ['🏠 City', 1.5, null], wall: ['🧱 City Wall', 4, null] };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const st = { att: [{ type: 'swordsman', hp: 15, vet: false }], def: { type: 'defender', hp: 15, vet: false, kind: 'forest', tech: true, poison: false } };
  const maxHp = u => E.maxHp(Object.assign({ carry: 'warrior' }, u));
  // unit list grouped by tribe (each unit once: the standard units first)
  const seen = new Set(), groups = (PP.TRIBES || []).map(t => ({ name: t.name, keys: t.units.filter(k => U[k] && !seen.has(k) && seen.add(k)) })).filter(g => g.keys.length);
  const opts = sel => groups.map(g => `<optgroup label="${esc(g.name)}">${g.keys.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(U[k].name)}</option>`).join('')}</optgroup>`).join('');
  function bonus(d, withTech) {
    const K = KIND[d.kind]; let b = K[1];
    if (K[2] && !withTech) b = 1;                                       // terrain bonus needs the tech
    if ((d.kind === 'city' || d.kind === 'wall') && !U[d.type].fort) b = 1; // only units with Fortify get it in a city
    return b;
  }
  function fight(order, b) {
    const d = st.def; let hp = d.hp, poison = d.poison; const steps = [];
    for (const a of order) {
      if (hp <= 0) { steps.push({ a, skip: true }); continue; }
      const r = E.attack(Object.assign({ carry: 'warrior' }, a), { type: d.type, hp, vet: d.vet, bonus: b, poison, carry: 'warrior' }, null, {});
      steps.push({ a, dmg: r.dmg, ret: r.ret, before: hp, after: r.defHp, aAfter: r.attHp, convert: r.convert, freeze: r.freeze });
      hp = r.defHp; if (r.poison) poison = true;
      if (r.convert) break;
    }
    const used = steps.filter(s => !s.skip), taken = used.reduce((t, s) => t + (s.a.hp - Math.max(0, s.aAfter)), 0);
    return { steps, hp, kill: hp <= 0 || used.some(s => s.convert), used: used.length, taken, lost: used.filter(s => s.aAfter <= 0).length };
  }
  function bestOrder() {
    const list = st.att, b = bonus(st.def, st.def.tech); let best = null, bs = null;
    const score = f => [f.kill ? 1 : 0, -f.lost, f.kill ? -f.used : 0, -f.taken, st.def.hp - f.hp];
    const better = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    (function perm(pre, rest) {
      if (!rest.length) { const s = score(fight(pre, b)); if (!bs || better(s, bs)) { bs = s; best = pre.slice(); } return; }
      rest.forEach((x, i) => perm(pre.concat([x]), rest.slice(0, i).concat(rest.slice(i + 1))));
    })([], list);
    if (best) st.att = best;
  }
  const hpCtl = (who, i, u) => `<span class="hp"><button data-hp="${who},${i},-1" aria-label="less HP">−</button><input data-hpv="${who},${i}" type="number" min="1" max="${maxHp(u)}" value="${u.hp}" aria-label="HP"><button data-hp="${who},${i},1" aria-label="more HP">+</button></span>`;
  const tog = (attr, on, label) => `<button class="tg${on ? ' on' : ''}" ${attr} aria-pressed="${on}">${label}</button>`;
  const fmtH = v => String(+(+v).toFixed(1));
  const outcome = (f, d) => f.kill ? `${esc(U[d.type].name)} dies <small>(attack ${f.steps.findIndex(s => s.after <= 0 || s.convert) + 1})</small>` : `${esc(U[d.type].name)} survives <small>with ${fmtH(f.hp)} HP</small>`;
  function render() {
    const d = st.def, K = KIND[d.kind], b = bonus(d, d.tech), f = fight(st.att, b);
    let h = '<div class="cgrid"><div class="cbox"><div class="chead"><b>Attacker' + (st.att.length > 1 ? 's' : '') + '</b>' +
      (st.att.length > 1 ? '<button class="lk" data-best>Best order</button>' : '') + (st.att.length < 6 ? '<button class="lk" data-add>+ Add</button>' : '') + '</div>';
    st.att.forEach((a, i) => {
      h += `<div class="crow">${st.att.length > 1 ? `<span class="no">${i + 1}</span>` : ''}<select data-type="att,${i}" aria-label="Attacker">${opts(a.type)}</select>${hpCtl('att', i, a)}` +
        tog(`data-vet="att,${i}"`, a.vet, 'Vet') + (st.att.length > 1 ? `<button class="x" data-del="${i}" aria-label="Remove">×</button>` : '') + '</div>';
    });
    h += '</div><div class="cbox"><div class="chead"><b>Defender</b></div>' +
      `<div class="crow"><select data-type="def,0" aria-label="Defender">${opts(d.type)}</select>${hpCtl('def', 0, d)}${tog('data-vet="def,0"', d.vet, 'Vet')}</div>` +
      `<div class="seg">${Object.keys(KIND).map(k => `<button data-kind="${k}" class="${d.kind === k ? 'on' : ''}">${KIND[k][0].replace(/^[^A-Za-z]+/, '').replace(' / ocean', '').replace('Field / none', 'Field')}</button>`).join('')}</div>` +
      `<div class="crow opts">${K[2] ? tog('data-tech', d.tech, 'Has ' + K[2]) : ''}${tog('data-poison', d.poison, 'Poisoned')}<span class="bon">Defense ×${b}</span></div></div></div>`;
    // result
    h += `<div class="cres"><div class="vline ${f.kill ? 'kill' : 'ok'}">${outcome(f, d)}</div><table>`;
    f.steps.forEach((s, i) => {
      h += s.skip ? `<tr class="skip"><td>${i + 1}</td><td>${esc(U[s.a.type].name)}</td><td colspan="2">not needed</td></tr>`
        : `<tr><td>${i + 1}</td><td>${esc(U[s.a.type].name)}</td><td>${s.freeze ? 'frozen' : s.convert ? 'converted' : `−${fmtH(s.dmg)} <small>${fmtH(s.before)} → ${s.after <= 0 ? '0' : fmtH(s.after)}</small>`}</td>` +
          `<td>${s.ret ? `↩ ${s.ret} <small>${s.aAfter <= 0 ? 'attacker dies' : s.aAfter + ' HP left'}</small>` : '<small>no retaliation</small>'}</td></tr>`;
    });
    h += '</table>';
    const terr = K[2] || ((d.kind === 'city' || d.kind === 'wall') && U[d.type].fort);
    if (terr) {
      const alt = K[2] ? fight(st.att, bonus(d, !d.tech)) : fight(st.att, 1);
      const lbl = K[2] ? (d.tech ? `Without ${K[2]}` : `With ${K[2]}`) : 'Without the city bonus';
      h += `<div class="alt${alt.kill !== f.kill ? ' flip' : ''}">${lbl}: ${outcome(alt, d)}${alt.kill !== f.kill ? ' – the bonus decides it' : ''}</div>`;
    }
    h += '</div>';
    root.innerHTML = h;
  }
  root.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.hp) { const [w, i, dd] = b.dataset.hp.split(','), u = w === 'def' ? st.def : st.att[+i]; u.hp = Math.max(1, Math.min(maxHp(u), u.hp + +dd)); }
    else if (b.dataset.kind) st.def.kind = b.dataset.kind;
    else if (b.hasAttribute('data-add')) st.att.push({ type: 'warrior', hp: 10, vet: false });
    else if (b.hasAttribute('data-best')) bestOrder();
    else if (b.dataset.vet) { const [w, i] = b.dataset.vet.split(','), u = w === 'def' ? st.def : st.att[+i], full = u.hp >= maxHp(u); u.vet = !u.vet; if (full || u.hp > maxHp(u)) u.hp = maxHp(u); }
    else if (b.hasAttribute('data-tech')) st.def.tech = !st.def.tech;
    else if (b.hasAttribute('data-poison')) st.def.poison = !st.def.poison;
    else if (b.dataset.del != null) st.att.splice(+b.dataset.del, 1);
    else return;
    render();
  });
  root.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset.type) { const [w, i] = t.dataset.type.split(','), u = w === 'def' ? st.def : st.att[+i]; u.type = t.value; u.hp = maxHp(u); }
    else if (t.dataset.vet) { const [w, i] = t.dataset.vet.split(','), u = w === 'def' ? st.def : st.att[+i], full = u.hp >= maxHp(u); u.vet = t.checked; if (full || u.hp > maxHp(u)) u.hp = maxHp(u); }
    else if (t.dataset.hpv) { const [w, i] = t.dataset.hpv.split(','), u = w === 'def' ? st.def : st.att[+i]; u.hp = Math.max(1, Math.min(maxHp(u), Math.round(+t.value) || 1)); }
    else if (t.hasAttribute('data-tech')) st.def.tech = t.checked;
    else if (t.hasAttribute('data-poison')) st.def.poison = t.checked;
    else return;
    render();
  });
  render();
})(window.PP);
