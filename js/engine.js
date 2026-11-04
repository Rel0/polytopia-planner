// Polytopia Planer v2 – pure game logic (no DOM). Unit-testable in node.
window.PP = window.PP || {};

(function (PP) {
  'use strict';

  var E = PP.engine = PP.engine || {};
  var UNITS = function () { return PP.UNITS; };

  function cheb(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }
  E.cheb = cheb;

  // ======================= Combat =======================

  // max HP; ships (carry) take the HP of the unit they carry (u.carry, default Warrior)
  E.baseHp = function (u) {
    var U = UNITS()[u.type];
    if (U && U.carry) { var C = UNITS()[u.carry] || UNITS().warrior; return (C && C.hp) || 10; }
    return (U && U.hp) || 10;
  };
  E.maxHp = function (u) {
    return E.baseHp(u) + (u.vet ? 5 : 0);
  };

  // Value of a unit for the optimizer (purchase price; super units 15; ships = carried unit + upgrade).
  E.unitValue = function (u) {
    var U = UNITS()[u.type];
    if (!U) return 0;
    if (U.carry) return E.unitValue({ type: UNITS()[u.carry] ? u.carry : 'warrior' }) + (U.up || 0);
    if (U.cost != null) return U.cost;
    return U.val != null ? U.val : (PP.GIANT_VALUE || 15);
  };

  // Poison halves the defense bonus (wiki: 1 → 0.5, 1.5 → 0.7, wall 4 → 2).
  E.poisonBonus = function (b) { b = b || 1; return b === 1 ? 0.5 : b === 1.5 ? 0.7 : b / 2; };

  // Raw Polytopia damage numbers (no skills): attacker att → defender def (def.bonus = effective defense bonus,
  // def.poison = poisoned). → { dmg, retRaw }
  E.raw = function (att, def) {
    var A = UNITS()[att.type], D = UNITS()[def.type];
    if (!A || !D || !(A.atk > 0)) return { dmg: 0, retRaw: 0 };
    var b = def.poison ? E.poisonBonus(def.bonus || 1) : (def.bonus || 1);
    var aF = A.atk * att.hp / E.maxHp(att);
    var dF = D.def * def.hp / E.maxHp(def) * b;
    var tot = aF + dF;
    if (!(tot > 0)) return { dmg: 0, retRaw: 0 };
    return { dmg: E.round(aF / tot * A.atk * 4.5), retRaw: E.round(dF / tot * D.def * 4.5) };
  };
  // Round to the nearest whole number, .5 up (warrior vs warrior = 4.5 → 5). The value is snapped to 6 decimals
  // first: exact ties like 7.5 otherwise come out of float math as 7.4999… and would be rounded the wrong way.
  E.round = function (x) { return Math.round(Math.round(x * 1e6) / 1e6); };
  // Splash and explosion (wiki "Combat"): the regular damage against that unit divided by 2 WITHOUT rounding,
  // so an odd damage leaves the unit at x.5 HP (an in-game quirk the wiki documents).
  E.splash = function (att, def) { return E.raw(att, def).dmg / 2; };
  // stomp / tentacles: the wiki gives no formula; half the regular damage, rounded down
  E.half = function (att, def) { return Math.floor(E.raw(att, def).dmg / 2); };

  // One attack with skills. dist = tile distance (null → attacker's range). opts.boom: explode instead of attacking.
  // Skills: stiff defender / surprise attacker / frozen defender → no retaliation; freeze (Ice Archer): no damage,
  // freezes the target; convert (Mind Bender, Siren, Shaman): target changes sides (the Shaman hits first);
  // explode: half damage, the attacker dies; poison: the target is poisoned after the hit.
  E.attack = function (att, def, dist, opts) {
    var A = UNITS()[att.type], D = UNITS()[def.type];
    var res = { dmg: 0, ret: 0, defHp: def.hp, attHp: att.hp };
    if (!A || !D) return res;
    var boom = !!A.explode && (A.boomOpt ? !!(opts && opts.boom) : true);
    if (A.freeze) { res.freeze = true; return res; }
    if (A.convert && !(A.atk > 0)) { res.convert = true; return res; }
    if (!(A.atk > 0)) return res;
    var r = E.raw(att, def);
    if (boom) {
      res.dmg = r.dmg / 2; res.defHp = Math.max(0, def.hp - res.dmg); res.attHp = 0; res.explode = true;
      if (res.defHp > 0) res.poison = true;
      return res;
    }
    var defHp = Math.max(0, def.hp - r.dmg);
    // the attacker moves until in range, so it attacks from min(dist, own range)
    var ad = dist == null ? Math.max(1, A.rng) : Math.max(1, Math.min(dist, A.rng));
    var conv = A.convert && defHp > 0;
    var ret = defHp > 0 && !conv && D.rng >= ad && !D.stiff && !A.surprise && !def.frozen ? r.retRaw : 0;
    res.dmg = r.dmg; res.ret = ret; res.defHp = defHp; res.attHp = Math.max(0, att.hp - ret);
    if (conv) res.convert = true;
    if (A.poison && defHp > 0) res.poison = true;
    if (D.poisonDef && res.attHp > 0) res.poisonAtt = true;
    return res;
  };

  // Defense bonus incl. city: own city on the unit's tile → walls ×4, else ×1.5.
  // Only units with Fortify get a city bonus (e.g. the Giant, Swordsman or Catapult don't).
  E.effectiveBonus = function (unit, cities) {
    var U = UNITS()[unit.type], fort = !U || !!U.fort;
    var list = cities || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.c === unit.c && c.r === unit.r) {
        // a unit standing in a foreign city gets no city bonus
        if (c.side && unit.side && c.side !== unit.side) break;
        if (!fort) return 1;
        return c.walls ? 4 : 1.5;
      }
    }
    if (!fort && (unit.bonusKind === 'city' || unit.bonusKind === 'wall')) return 1;
    return unit.bonus || 1;
  };

  E.canReach = function (att, def, dist) {
    var A = UNITS()[att.type];
    if (!A) return false;
    if (dist == null) return true;
    if (att.frozen) return false;
    return dist <= A.mov + Math.max(1, A.rng);
  };

  // Objective vector: [killedValue↑, losses↓, lostValue↓, dmgTaken↓, dmgDealt↑, used↓, kills]
  var ZERO = [0, 0, 0, 0, 0, 0, 0];
  function vadd(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4], a[5] + b[5], a[6] + b[6]];
  }
  // true if a is strictly better than b
  function vbetter(a, b) {
    if (a[0] !== b[0]) return a[0] > b[0];
    if (a[1] !== b[1]) return a[1] < b[1];
    if (a[2] !== b[2]) return a[2] < b[2];
    if (a[3] !== b[3]) return a[3] < b[3];
    if (a[4] !== b[4]) return a[4] > b[4];
    return a[5] < b[5];
  }
  E._vbetter = vbetter;

  // Simulate one target attacked by attackers in the given order.
  function simulate(target, order, distOf) {
    var hp = target.hp, v = ZERO.slice(), steps = [];
    for (var i = 0; i < order.length; i++) {
      var a = order[i];
      if (hp <= 0) {
        steps.push({ attackerId: a.id, dmg: 0, ret: 0, targetHpAfter: 0, attackerHpAfter: a.hp, skipped: true });
        v[5]++;
        continue;
      }
      var t = Object.assign({}, target, { hp: hp });
      var r = E.attack(a, t, distOf(a));
      var dealt = hp - r.defHp, taken = Math.min(r.ret, a.hp), died = r.attHp <= 0;
      v[4] += dealt; v[3] += taken; v[5]++;
      if (died) { v[1]++; v[2] += E.unitValue(a); }
      hp = r.defHp;
      if (hp <= 0) { v[0] += E.unitValue(target); v[6]++; }
      steps.push({ attackerId: a.id, dmg: r.dmg, ret: r.ret, targetHpAfter: hp, attackerHpAfter: r.attHp, skipped: false });
    }
    return { v: v, steps: steps, hp: hp };
  }
  E._simulate = simulate;
  E._ZERO = ZERO;

  var MAX_OPT = 12; // attackers handled by the exact optimizer

  E.planAttack = function (attackers, targets, distFn) {
    attackers = (attackers || []).filter(Boolean);
    targets = (targets || []).filter(Boolean);
    var dist = function (a, t) {
      if (!distFn) return null;
      var d = distFn(a, t);
      return d == null || isNaN(d) ? null : d;
    };

    var idle = [], unreachable = [], noAttack = [], pool = [];
    attackers.forEach(function (a) {
      var A = UNITS()[a.type];
      if (!A || !(A.atk > 0) || !(a.hp > 0)) { idle.push(a.id); noAttack.push(a.id); return; }
      var any = targets.some(function (t) { return E.canReach(a, t, dist(a, t)); });
      if (targets.length && !any) unreachable.push(a.id);
      else pool.push(a);
    });
    var truncated = false;
    if (pool.length > MAX_OPT) {
      truncated = true;
      pool.slice(MAX_OPT).forEach(function (a) { idle.push(a.id); });
      pool = pool.slice(0, MAX_OPT);
    }

    var n = pool.length, T = targets.length, full = (1 << n);
    // per-target reach mask + distance table
    var reach = [], dtab = [];
    targets.forEach(function (t, j) {
      var m = 0; dtab[j] = [];
      pool.forEach(function (a, i) {
        var d = dist(a, t); dtab[j][i] = d;
        if ((t.hp > 0) && E.canReach(a, t, d)) m |= 1 << i;
      });
      reach[j] = m;
    });

    // Best order for (target j, subset S, current target hp) via DP over remaining subset.
    var memos = targets.map(function () { return new Map(); });
    var atkCache = targets.map(function () { return new Map(); });
    function attackJ(j, i, hp) {
      var key = hp * 64 + i, c = atkCache[j].get(key);
      if (!c) {
        c = E.attack(pool[i], Object.assign({}, targets[j], { hp: hp }), dtab[j][i]);
        atkCache[j].set(key, c);
      }
      return c;
    }
    function best(j, S, hp) {
      if (S === 0) return { v: ZERO, a: -1 };
      var key = hp * full + S, m = memos[j].get(key);
      if (m) return m;
      var res;
      if (hp <= 0) {
        var cnt = 0; for (var s = S; s; s &= s - 1) cnt++;
        res = { v: [0, 0, 0, 0, 0, cnt, 0], a: -1 };
      } else {
        var tval = E.unitValue(targets[j]);
        for (var i = 0; i < n; i++) {
          if (!(S & (1 << i))) continue;
          var a = pool[i], r = attackJ(j, i, hp);
          var died = r.attHp <= 0, killed = r.defHp <= 0;
          var step = [killed ? tval : 0, died ? 1 : 0, died ? E.unitValue(a) : 0,
            Math.min(r.ret, a.hp), hp - r.defHp, 1, killed ? 1 : 0];
          var v = vadd(step, best(j, S & ~(1 << i), r.defHp).v);
          if (!res || vbetter(v, res.v)) res = { v: v, a: i };
        }
      }
      memos[j].set(key, res);
      return res;
    }

    // Assignment DP over targets: state = mask of used attackers.
    var cur = new Map(); cur.set(0, ZERO);
    var backs = [];
    for (var j = 0; j < T; j++) {
      var next = new Map(), back = new Map();
      cur.forEach(function (val, mask) {
        var avail = reach[j] & ~mask;
        // enumerate all subsets of avail (incl. empty)
        for (var sub = avail; ; sub = (sub - 1) & avail) {
          var g = sub ? best(j, sub, targets[j].hp).v : ZERO;
          var cand = vadd(val, g), m2 = mask | sub, old = next.get(m2);
          if (!old || vbetter(cand, old)) { next.set(m2, cand); back.set(m2, { prev: mask, sub: sub }); }
          if (sub === 0) break;
        }
      });
      backs.push(back); cur = next;
    }
    var bestMask = 0, bestV = null;
    cur.forEach(function (val, mask) { if (!bestV || vbetter(val, bestV)) { bestV = val; bestMask = mask; } });

    // reconstruct
    var subs = new Array(T), mk = bestMask;
    for (j = T - 1; j >= 0; j--) { var b = backs[j].get(mk); subs[j] = b.sub; mk = b.prev; }

    var groups = [], used = 0;
    var summary = { kills: 0, killedValue: 0, losses: 0, lostValue: 0, dmgDealt: 0, dmgTaken: 0, attackersUsed: 0 };
    targets.forEach(function (t, j) {
      var S = subs[j] || 0, hp = t.hp, orderIdx = [];
      while (S) {
        var r = best(j, S, hp);
        if (r.a < 0) { // remaining would be skipped (does not happen in an optimal plan)
          for (var i = 0; i < n; i++) if (S & (1 << i)) orderIdx.push(i);
          break;
        }
        orderIdx.push(r.a);
        hp = attackJ(j, r.a, hp).defHp;
        S &= ~(1 << r.a);
      }
      used |= subs[j] || 0;
      var order = orderIdx.map(function (i) { return pool[i]; });
      var sim = simulate(t, order, function (a) { return dtab[j][pool.indexOf(a)]; });
      var v = sim.v;
      summary.kills += v[6]; summary.killedValue += v[0]; summary.losses += v[1]; summary.lostValue += v[2];
      summary.dmgTaken += v[3]; summary.dmgDealt += v[4]; summary.attackersUsed += v[5];
      groups.push({ targetId: t.id, order: order.map(function (a) { return a.id; }), steps: sim.steps,
        targetHp: t.hp, targetHpAfter: sim.hp, killed: sim.hp <= 0 && order.length > 0 });
    });
    pool.forEach(function (a, i) { if (!(used & (1 << i))) idle.push(a.id); });

    return {
      groups: groups, idle: idle, unreachable: unreachable, noAttack: noAttack, truncated: truncated,
      summary: summary, score: bestV || ZERO,
      verdict: verdict(summary, attackers.length, targets.length, unreachable.length),
    };
  };

  function units(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function verdict(s, nA, nT, nUnreach) {
    if (!nA || !nT) return { level: 'no', title: 'Don’t attack', reason: 'Select attackers and targets.' };
    if (nUnreach === nA) return { level: 'no', title: 'Don’t attack', reason: 'None of your units can reach a target.' };
    var k = units(s.kills, 'unit', 'units'), l = units(s.losses, 'unit', 'units');
    if (s.kills > 0 && s.losses === 0) {
      return { level: 'go', title: 'Attack!', reason: 'You kill ' + k + ' with no losses.' };
    }
    if (s.kills > 0 && s.killedValue > s.lostValue) {
      return { level: 'risky', title: 'Worth it – with losses',
        reason: 'You kill ' + k + ' (' + s.killedValue + ' ★) and lose ' + l + ' (' + s.lostValue + ' ★).' };
    }
    if (s.kills === 0 && s.losses === 0 && s.dmgDealt > s.dmgTaken) {
      return { level: 'weak', title: 'Weaken only',
        reason: 'No target dies, but you deal ' + s.dmgDealt + ' damage and take only ' + s.dmgTaken + ' in retaliation.' };
    }
    var reason;
    if (s.kills > 0) reason = 'You kill ' + k + ' (' + s.killedValue + ' ★), but lose ' + l + ' (' + s.lostValue + ' ★).';
    else if (s.losses > 0) reason = 'No target dies and you lose ' + l + '.';
    else if (s.dmgDealt === 0) reason = 'Your units can’t deal any damage.';
    else reason = 'No target dies: ' + s.dmgDealt + ' damage, but ' + s.dmgTaken + ' retaliation.';
    return { level: 'no', title: 'Don’t attack', reason: reason };
  }

  // ======================= Economy =======================

  E.techCost = function (tech, cityCount, owned) {
    var t = typeof tech === 'string' ? PP.TECH[tech] : tech;
    var tier = t && t.tier || 1;
    var base = tier * Math.max(1, cityCount || 1) + 4;
    return owned && owned.indexOf('philosophy') >= 0 ? Math.ceil(base * 2 / 3) : base;
  };

  // Reward options for the level a city reaches (5+ → park | giant).
  E.rewardOptions = function (level) {
    var R = PP.CITY_REWARDS;
    return R[level] || (level >= 5 ? R[5] : []);
  };

  function findReward(level, id) {
    var opts = E.rewardOptions(level);
    for (var i = 0; i < opts.length; i++) if (opts[i].id === id) return opts[i];
    return null;
  }

  E.planEconomy = function (build, cities) {
    build = build || {};
    var stars = +build.stars || 0, income = +build.income || 0;
    var owned = build.owned || [], planned = build.planned || [];
    var counts = build.unitCounts || {}, placements = build.placements || [], rewards = build.rewards || {};
    var own = (cities || []).filter(function (c) { return c && c.side === 'me'; });
    var cityCount = Math.max(1, own.length);
    var has = function (id) { return !id || owned.indexOf(id) >= 0 || planned.indexOf(id) >= 0; };
    var lines = [], warnings = [], spent = 0;
    var cityName = function (c) { return c.name || ('City Lv' + (c.level || 1)); };

    // techs
    planned.forEach(function (id) {
      var t = PP.TECH[id];
      if (!t || owned.indexOf(id) >= 0) return;
      var cost = E.techCost(t, cityCount, owned);
      lines.push({ icon: '🔬', label: t.name, cost: cost, kind: 'tech', id: id, n: 1 });
      spent += cost;
      if (t.parent && !has(t.parent)) warnings.push(t.name + ' needs ' + PP.TECH[t.parent].name + ' first.');
    });

    // units
    Object.keys(counts).forEach(function (type) {
      var n = +counts[type] || 0, U = PP.UNITS[type];
      if (n <= 0 || !U || U.cost == null) return;
      var cost = U.cost * n;
      lines.push({ icon: U.icon, label: (n > 1 ? n + '× ' : '') + U.name, cost: cost, kind: 'unit', id: type, n: n });
      spent += cost;
      if (U.tech && !has(U.tech)) warnings.push(U.name + ' needs ' + PP.TECH[U.tech].name + '.');
    });

    // placements: cost lines (grouped per item), pop per placement → nearest own city (≤ 2)
    var byItem = {}, itemOrder = [];
    var cityGain = own.map(function () { return 0; });
    var placementInfo = [], unassignedPop = 0;
    placements.forEach(function (p) {
      var it = PP.ITEM ? PP.ITEM[p.item] : null;
      if (!it) for (var k = 0; k < PP.ITEMS.length; k++) if (PP.ITEMS[k].id === p.item) it = PP.ITEMS[k];
      if (!it) return;
      if (!byItem[it.id]) { byItem[it.id] = 0; itemOrder.push(it); }
      byItem[it.id]++;
      spent += it.cost;
      var pop = it.pop || 0;
      if (it.adj) {
        placements.forEach(function (q) { if (q !== p && q.item === it.adj.item && cheb(p, q) === 1) pop += it.adj.pop; });
      }
      var ci = -1, bd = 3;
      own.forEach(function (c, i) { var d = cheb(p, c); if (d <= 2 && d < bd) { bd = d; ci = i; } });
      if (ci >= 0) cityGain[ci] += pop; else unassignedPop += pop;
      placementInfo.push({ id: p.id, item: it.id, pop: pop, cityId: ci >= 0 ? own[ci].id : null });
    });
    itemOrder.forEach(function (it) {
      var n = byItem[it.id];
      lines.push({ icon: it.icon, label: (n > 1 ? n + '× ' : '') + it.name, cost: it.cost * n, kind: 'item', id: it.id, n: n });
      if (it.tech && !has(it.tech)) warnings.push(it.name + ' needs ' + PP.TECH[it.tech].name + '.');
    });
    if (unassignedPop > 0) {
      warnings.push(unassignedPop + ' 👥 go to no city (no own city within 2 tiles).');
    }

    // city growth simulation with cascading rewards
    var rewardStars = 0, incomeGain = 0;
    var cityRes = own.map(function (c, i) {
      var level = Math.max(1, +c.level || 1), pop = (+c.pop || 0) + cityGain[i], walls = !!c.walls;
      var levelUps = [], guard = 0;
      var cityIncome = 0, cityStars = 0;
      while (pop >= level + 1 && guard++ < 50) {
        pop -= level + 1; level++;
        cityIncome += 1; // every level gives +1 ★/turn
        var chosenId = rewards[c.id + ':' + level] || null, ch = chosenId ? findReward(level, chosenId) : null;
        if (ch) {
          var ef = ch.effect || {};
          if (ef.stars) cityStars += ef.stars;
          if (ef.income) cityIncome += ef.income;
          if (ef.pop) pop += ef.pop;
          if (ef.walls) walls = true;
        } else {
          warnings.push(cityName(c) + ' reaches level ' + level + ': choose a reward.');
        }
        levelUps.push({ level: level, options: E.rewardOptions(level), chosen: ch ? ch.id : null });
      }
      rewardStars += cityStars; incomeGain += cityIncome;
      return { id: c.id, name: c.name || '', level: +c.level || 1, pop: +c.pop || 0, newLevel: level, newPop: pop,
        popGain: cityGain[i], needed: level + 1, levelUps: levelUps, walls: walls,
        incomeGain: cityIncome, rewardStars: cityStars };
    });

    var available = stars + rewardStars, rest = available - spent, nextIncome = income + incomeGain;
    if (rest < 0) warnings.unshift('You’re short ' + (-rest) + ' ★.');

    return {
      lines: lines, spent: spent, rewardStars: rewardStars, available: available, rest: rest,
      nextIncome: nextIncome, nextTurnStars: Math.max(0, rest) + nextIncome,
      cities: cityRes, unassignedPop: unassignedPop, warnings: warnings,
      placements: placementInfo, cityCount: cityCount, incomeGain: incomeGain,
    };
  };
})(window.PP);
