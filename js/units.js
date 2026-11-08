// Polytopia Planer v6 – UNITS: mode 'units' (v12: small badges centred on the figures, symbols from PP.icons;
// v13: Battle can be calculated as the enemy too – "Attacker: Me | Enemy" – with a "City falls?" verdict).
// Unit palette in the drawer, small 2D coins with vector glyphs on the map, attacker/target selection,
// damage calculator (table with inline HP steppers) in the drawer, thin numbered arrows on the map,
// long-press coin editor; v16: unit detection only via AI (PP.ai, needs an API key), descriptive defense bonus
// (unit.bonusKind: none | forest | mountain | water | city | wall).
window.PP = window.PP || {};
(function (PP) {
  'use strict';

  // ================================================================ styles (.un-*)
  var CSS = [
    '.un{font-size:14px;line-height:1.35}',
    '.un h4{margin:12px 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9aa5c8);font-weight:800;display:flex;align-items:center;gap:8px}',
    '.un h4 span{flex:1}',
    '.un h4 button{border:0;background:none;color:var(--accent,#4cc9f0);font-size:12px;font-weight:700;padding:4px 2px;text-transform:none;letter-spacing:0;min-height:28px}',
    '.un-side{display:flex;background:var(--bg,#12172b);border-radius:12px;padding:3px;gap:3px}',
    '.un-side button{flex:1;border:0;background:none;border-radius:9px;padding:8px 4px;font-weight:700;font-size:13.5px;color:var(--muted,#9aa5c8);display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;min-width:0}',
    '.un-side button i{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.25)}',
    '.un-side button.on{color:#fff}',
    '.un-side button.on.me{background:#2c62c9}.un-side button.on.enemy{background:#c62f47}',
    '.un-pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,1fr));gap:3px;margin-top:6px}',
    '.un-pal button{border:1px solid transparent;background:var(--panel2,#252e52);border-radius:10px;padding:3px 0 2px;display:flex;flex-direction:column;align-items:center;gap:0;min-height:46px;min-width:0;color:var(--muted,#9aa5c8);overflow:hidden}',
    '.un-pal button b{font-size:8.5px;font-weight:700;max-width:100%;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:clip;padding:0 1px;letter-spacing:-.04em}',
    '.un-pal button.on{border-color:#ffd23f;background:rgba(255,210,63,.16);color:var(--text,#e8ecf8)}',
    '.un-pal svg{display:block;flex:none}',
    // sub-mode switch (Place | Battle)
    '.un-top{display:flex;gap:5px;align-items:stretch;margin-bottom:6px}',
    '.un-mode{display:flex;flex:1 1 auto;background:var(--bg,#12172b);border-radius:12px;padding:3px;gap:3px;min-width:0}',
    '.un-mode button{flex:1;border:0;background:none;border-radius:9px;padding:4px 2px;font-weight:800;font-size:13px;color:var(--muted,#9aa5c8);min-height:36px;min-width:0;white-space:nowrap}',
    '.un-mode button.on{background:var(--panel2,#2e3866);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}',
    '.un-top .un-side{flex:none;padding:3px;gap:2px}',
    '.un-top .un-side button{min-height:36px;padding:0 6px;font-size:12px;gap:4px;flex:none}',
    '.un-top .un-side button i{width:10px;height:10px}',
    '.un-era{border:1px solid var(--line,#33406e);background:none;color:var(--muted,#9aa5c8);border-radius:12px;padding:0;width:40px;font-size:17px;min-height:40px;flex:none}',
    '.un-era.on{border-color:#ff8ca6;color:#ff8ca6;background:rgba(239,71,111,.14)}',
    // quick editor (place mode)
    '.un-qe{margin-top:8px;border:1px solid rgba(76,201,240,.55);background:rgba(76,201,240,.07);border-radius:14px;padding:7px 8px 8px}',
    '.un-qe .hd{display:flex;align-items:center;gap:6px;min-width:0}',
    '.un-qe .hd .ty{flex:1;min-width:0;display:flex;align-items:center;gap:6px;border:0;background:none;color:var(--text,#e8ecf8);padding:0;text-align:left;min-height:34px}',
    '.un-qe .hd .ty b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.un-qe .hd .ty small{color:var(--muted,#9aa5c8);font-size:11px;font-weight:600;white-space:nowrap}',
    '.un-qe .sd{display:inline-flex;background:var(--bg,#12172b);border-radius:9px;padding:2px;gap:2px;flex:none}',
    '.un-qe .sd button{border:0;background:none;border-radius:7px;width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center}',
    '.un-qe .sd button i{width:12px;height:12px;border-radius:50%;opacity:.45}',
    '.un-qe .sd button.on{background:var(--panel2,#252e52)}.un-qe .sd button.on i{opacity:1;box-shadow:0 0 0 2px rgba(255,255,255,.6)}',
    '.un-qe .del{border:0;background:rgba(239,71,111,.2);color:#ff8ca6;border-radius:9px;height:34px;padding:0 9px;font-weight:800;font-size:12.5px;flex:none}',
    '.un-qe .types{display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:3px;margin-top:6px}',
    '.un-qe .types button{border:1px solid transparent;background:var(--panel2,#252e52);border-radius:9px;padding:2px 0;min-height:36px;display:flex;align-items:center;justify-content:center}',
    '.un-qe .types button.on{border-color:#ffd23f;background:rgba(255,210,63,.16)}',
    '.un-qe .ln{display:flex;align-items:center;gap:6px;margin-top:7px;flex-wrap:wrap}',
    '.un-qe .big{display:inline-flex;align-items:center;background:var(--bg,#12172b);border-radius:11px;padding:2px;flex:none}',
    '.un-qe .big button{border:0;background:var(--panel2,#252e52);color:var(--text,#e8ecf8);width:40px;height:38px;border-radius:9px;font-size:21px;font-weight:800;line-height:1;padding:0}',
    '.un-qe .big b{min-width:54px;text-align:center;font-size:17px}',
    '.un-qe .big b small{color:var(--muted,#9aa5c8);font-weight:600;font-size:11.5px}',
    '.un-qe .chip{border:1px solid var(--line,#33406e);background:none;color:var(--text,#e8ecf8);border-radius:10px;height:38px;padding:0 9px;font-weight:700;font-size:12.5px;flex:none}',
    '.un-qe .chip.on{border-color:#ffd23f;color:#ffd23f;background:rgba(255,210,63,.12)}',
    '.un-qe .chip:disabled{opacity:.4}',
    '.un-bon4{display:flex;flex-wrap:wrap;background:var(--bg,#12172b);border-radius:10px;padding:3px;gap:3px;width:100%;box-sizing:border-box}',
    '.un-bon4 button{flex:1 1 auto;border:0;background:none;color:var(--muted,#9aa5c8);border-radius:8px;padding:0 7px;min-height:32px;font-size:12px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.un-bon4 button small{font-weight:600;opacity:.8;font-size:10.5px}',
    '.un-bon4 button.au{flex:1 1 100%;text-align:left;padding-left:9px}',
    '.un-bon4 button.on{background:var(--panel2,#252e52);color:var(--text,#e8ecf8);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}',
    '.un-bon4 button.on.w4{box-shadow:inset 0 0 0 1px #f0c27a;color:#f0c27a}',
    '.un-why{font-size:11px;color:var(--muted,#9aa5c8);margin-top:3px;line-height:1.3}',
    '.un-why b{color:var(--text,#e8ecf8);font-weight:700}',
    '.un-how{color:var(--muted,#9aa5c8);font-size:12.5px;margin:6px 0 2px}',
    '.un-how b{color:var(--text,#e8ecf8)}',
    '.un-n{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;border-radius:10px;background:#ffd23f;color:#1d1a10;font-weight:800;font-size:11.5px;padding:0 4px;flex:none}',
    '.un-n.t{background:#ff4d6d;color:#fff}',
    // target chips
    '.un-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 0 4px;margin:0 -2px;scrollbar-width:none}',
    '.un-tabs::-webkit-scrollbar{display:none}',
    '.un-tab{display:flex;align-items:center;gap:5px;border:1px solid var(--line,#33406e);background:var(--panel2,#252e52);color:var(--text,#e8ecf8);border-radius:999px;padding:3px 9px 3px 3px;font-size:12px;font-weight:700;min-height:34px;flex:none}',
    '.un-tab.on{border-color:#ff4d6d;box-shadow:inset 0 0 0 1px #ff4d6d;background:rgba(255,77,109,.14)}',
    '.un-tab em{font-style:normal;color:var(--muted,#9aa5c8);font-weight:700}',
    '.un-tab em.k{color:#06d6a0}',
    // target card
    '.un-card{border:1px solid rgba(255,77,109,.55);background:rgba(255,77,109,.07);border-radius:14px;padding:8px;margin-top:4px}',
    '.un-th{display:flex;align-items:center;gap:8px}',
    '.un-th .nm{flex:1;min-width:0}',
    '.un-th .nm b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.un-th .nm small{display:block;color:var(--muted,#9aa5c8);font-size:11.5px}',
    '.un-x{border:0;background:var(--panel2,#252e52);color:var(--text,#e8ecf8);width:32px;height:32px;border-radius:9px;font-weight:800;flex:none;font-size:14px}',
    '.un-ctl{display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap}',
    '.un-ctl>span{font-size:11.5px;color:var(--muted,#9aa5c8);font-weight:700}',
    '.un-hp{display:inline-flex;align-items:center;background:var(--bg,#12172b);border-radius:10px;padding:2px;flex:none}',
    '.un-hp button{border:0;background:var(--panel2,#252e52);color:var(--text,#e8ecf8);width:30px;height:30px;border-radius:8px;font-size:17px;font-weight:800;line-height:1;padding:0}',
    '.un-hp b{min-width:42px;text-align:center;font-size:13.5px}',
    '.un-hp b small{color:var(--muted,#9aa5c8);font-weight:600;font-size:11px}',
    '.un-bon{display:inline-flex;background:var(--bg,#12172b);border-radius:10px;padding:2px;gap:2px}',
    '.un-bon button{border:0;background:none;color:var(--muted,#9aa5c8);border-radius:8px;padding:0 8px;height:30px;font-size:12px;font-weight:700}',
    '.un-bon button.on{background:var(--panel2,#252e52);color:var(--text,#e8ecf8)}',
    // damage rows (stacked, works down to ~180 px drawer width)
    '.un-tbl{margin-top:8px}',
    '.un-row{border-top:1px solid rgba(255,255,255,.09);padding:7px 0 6px}',
    '.un-row .l1{display:flex;align-items:center;gap:5px;min-width:0}',
    '.un-row .l1 b{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.un-row .rm{border:0;background:none;color:var(--muted,#9aa5c8);font-size:13px;width:30px;height:30px;padding:0;border-radius:8px;flex:none}',
    '.un-row .l2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:5px}',
    '.un-row .st{background:var(--bg,#12172b);border-radius:9px;padding:3px 4px 4px;text-align:center;font-weight:800;font-size:16px;line-height:1.1;min-width:0}',
    '.un-row .st small{display:block;font-size:9.5px;font-weight:700;color:var(--muted,#9aa5c8);text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.un-row .st.dmg{color:#ff8ca6}.un-row .st.ret{color:#ffd166}.un-row .st.z{color:var(--muted,#9aa5c8)}.un-row .st.kill{color:#06d6a0}',
    '.un-row .l3{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11.5px;color:var(--muted,#9aa5c8);flex-wrap:wrap;min-width:0}',
    '.un-row .l3 .grow{flex:1;min-width:0}',
    '.un-row .die{color:#ff8ca6;font-weight:800}',
    '.un-row .far{color:#ffbe3d;font-weight:700}',
    '.un-row.skip .l1 b{color:var(--muted,#9aa5c8)}',
    '.un-res{margin-top:8px;padding:7px 9px;border-radius:10px;font-weight:800;font-size:13.5px;background:rgba(255,77,109,.14);color:#ff8ca6}',
    '.un-res.kill{background:rgba(6,214,160,.15);color:#06d6a0}',
    '.un-res small{display:block;font-weight:700;font-size:11.5px;color:var(--muted,#9aa5c8);margin-top:2px}',
    '.un-res.hold{background:rgba(120,150,230,.14);color:#a9c4ff}',
    '.un-res.good{background:rgba(6,214,160,.15);color:#06d6a0}',
    '.un-res.bad{background:rgba(255,77,109,.18);color:#ff8ca6}',
    // v13: attacker side (Battle): Me | Enemy
    '.un-att{display:flex;align-items:center;gap:6px;margin:0 0 6px}',
    '.un-att>span{font-size:11.5px;font-weight:800;color:var(--muted,#9aa5c8);text-transform:uppercase;letter-spacing:.05em}',
    '.un-att .un-side{flex:1}',
    '.un-peek .sd1.as{font-size:9px}',
    '.un-peek .sum .city{font-weight:800}',
    '.un-btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}',
    '.un-tech{margin-left:4px;border:1px solid var(--line,#33406e);border-radius:8px;padding:3px 8px;background:var(--panel2,#252e52);color:var(--text,#e8ecf8);font-size:12px;font-weight:700}',
    '.un-tech.on{border-color:#06d6a0;color:#06d6a0}',
    '.un-seqb{display:block;width:100%;border:0;border-radius:11px;padding:10px;margin:0 0 8px;font-weight:800;font-size:14px;background:var(--accent,#4cc9f0);color:#08121f;min-height:44px}',
    '.un-seqb small{font-weight:600;opacity:.75}',
    '.un-seqb.on{background:var(--panel2,#252e52);color:var(--text,#e8ecf8);box-shadow:inset 0 0 0 2px var(--accent,#4cc9f0)}',
    '.un-seq{margin:0 0 10px;padding:8px 10px;border:1px solid var(--line,#33406e);border-radius:12px;background:rgba(76,201,240,.06);font-size:13px}',
    '.un-seq .sum{font-size:14px;margin-bottom:6px}',
    '.un-seq .tg{margin:6px 0;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.04)}',
    '.un-seq .th{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.un-seq .th button{margin-left:auto;border:0;border-radius:8px;padding:5px 9px;font-weight:700;font-size:12px;background:var(--panel2,#252e52);color:var(--accent,#4cc9f0)}',
    '.un-seq .st{display:flex;align-items:center;gap:6px;margin:4px 0 0 4px}',
    '.un-seq .st small,.un-seq .th small{color:var(--muted,#9aa5c8)}',
    '.un-seq .die{color:#ff6b81;font-weight:700}',
    '.un-seq .free{margin-top:6px;color:var(--muted,#9aa5c8)}',
    '.un-seq .nt{display:block;margin-top:6px;color:var(--muted,#9aa5c8);font-size:11.5px}',
    '.un-seq .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin:2px 0 4px}',
    '.un-seq .bar i{display:block;height:100%;background:var(--accent,#4cc9f0)}',
    '.un-sort{margin:0 0 12px}',
    '.un-sort>span{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9aa5c8);margin-bottom:4px}',
    '.un-sort>div{display:flex;gap:4px;background:var(--bg,#12172b);border-radius:11px;padding:3px}',
    '.un-sort button{flex:1 1 0;min-width:0;border:0;background:none;border-radius:9px;padding:7px 4px;font-size:12px;font-weight:700;color:var(--muted,#9aa5c8);min-height:36px;line-height:1.15}',
    '.un-sort button.on{background:var(--panel2,#252e52);color:var(--text,#e8ecf8);box-shadow:inset 0 0 0 1.5px var(--accent,#4cc9f0)}',
    '.un-sort small{display:block;font-size:11px;color:var(--muted,#9aa5c8);margin-top:4px}',
    '.un-btns button{flex:1 1 90px;border:0;border-radius:11px;padding:8px 6px;font-weight:800;font-size:13px;background:var(--panel2,#252e52);color:var(--text,#e8ecf8);min-height:42px;min-width:0}',
    '.un-btns button.go{background:#ef476f;color:#fff;flex-basis:100%}',
    '.un-btns button.lt{background:none;border:1px solid var(--line,#33406e);color:var(--muted,#9aa5c8)}',
    '.un-link{border:0;background:none;color:var(--accent,#4cc9f0);font-weight:700;font-size:12.5px;padding:8px 2px 2px;min-height:32px}',
    '.un-empty{color:var(--muted,#9aa5c8);font-size:12.5px;padding:6px 2px 2px}',
    '.un-sec{margin-top:14px;padding-top:10px;border-top:1px solid var(--line,#33406e)}',
    '.un-sec .un-ai{background:none;border:0;color:var(--muted,#9aa5c8);font-size:11.5px;padding:6px 2px;text-decoration:underline;text-underline-offset:2px;opacity:.85}',
    '.un-sec .un-auto{width:100%;border:1px dashed var(--line,#33406e);background:none;color:var(--muted,#9aa5c8);border-radius:11px;padding:9px;font-weight:700;font-size:12.5px;min-height:40px}',
    '.un-q{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.45);border-radius:12px;padding:7px 8px;margin-top:8px;font-size:12.5px}',
    '.un-q b{width:100%}',
    '.un-q button{display:flex;align-items:center;gap:6px;border:1px solid var(--line,#33406e);background:var(--panel2,#252e52);color:var(--text,#e8ecf8);border-radius:999px;padding:4px 10px 4px 4px;font-weight:700;font-size:12px;min-height:36px}',
    '.un-q button i{display:inline-block;width:24px;height:24px;border-radius:50%;border:2px solid #fff}',
    '.un-q .lt{border:0;background:none;color:var(--accent,#4cc9f0);padding:4px}',
    '.un-foot{display:flex;gap:6px;margin-top:8px}',
    '.un-foot button{flex:1;border:0;background:none;color:var(--muted,#9aa5c8);font-size:12px;font-weight:700;padding:8px 4px;min-height:36px;text-decoration:underline}',
    // v8: compact peek row (bottom sheet on phones shows only this part until expanded / scrolled)
    '.un-peek{display:flex;align-items:center;gap:5px;min-height:46px;min-width:0}',
    '.un-peek .sd1{flex:none;width:42px;height:46px;border:0;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:9.5px;font-weight:800;color:#fff;padding:0;line-height:1}',
    '.un-peek .sd1 i{font-style:normal;font-size:14px;opacity:.9}',
    '.un-peek .sd1.me{background:#2c62c9}.un-peek .sd1.enemy{background:#c62f47}',
    '.un-peek .un-pal{flex:1 1 auto;margin:0;grid-template-columns:repeat(9,minmax(0,1fr));gap:2px}',
    // v27: more than 9 units → rows; in the phone sheet's compact peek state one row that scrolls sideways
    '#drawer.peek .un-peek .un-pal{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:calc((100% - 16px) / 8.5);overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;scroll-snap-type:x proximity}',
    '#drawer.peek .un-peek .un-pal::-webkit-scrollbar{display:none}',
    '#drawer.peek .un-peek .un-pal button{scroll-snap-align:start}',
    '.un-peek .un-pal button{min-height:46px;padding:3px 0 2px}',
    '.un-peek .un-pal button b{font-size:8px;letter-spacing:-.05em}',
    '.un-peek .cn{flex:none;display:flex;align-items:center}',
    '.un-peek .big{display:inline-flex;align-items:center;background:var(--bg,#12172b);border-radius:12px;padding:2px;flex:none}',
    '.un-peek .big button{border:0;background:var(--panel2,#252e52);color:var(--text,#e8ecf8);width:40px;height:40px;border-radius:10px;font-size:22px;font-weight:800;line-height:1;padding:0}',
    '.un-peek .big b{min-width:50px;text-align:center;font-size:17px;white-space:nowrap}',
    '.un-peek .big b small{color:var(--muted,#9aa5c8);font-weight:600;font-size:11.5px}',
    '.un-peek .pb{flex:none;height:44px;min-width:44px;border:1px solid var(--line,#33406e);background:none;color:var(--text,#e8ecf8);border-radius:11px;padding:0 8px;font-weight:800;font-size:13px;white-space:nowrap}',
    '.un-peek .pb.on{border-color:#ffd23f;color:#ffd23f;background:rgba(255,210,63,.14)}',
    '.un-peek .pb.del{border:0;background:rgba(239,71,111,.2);color:#ff8ca6;font-size:18px;padding:0;width:44px}',
    '.un-peek .pb.ok{border:0;background:var(--panel2,#252e52);font-size:17px;padding:0;width:42px}',
    '.un-peek .pb.go{border:0;background:#ef476f;color:#fff}',
    '.un-peek .gap{flex:1 1 0;min-width:0}',
    '.un-peek .sum{flex:1;min-width:0;font-size:13.5px;font-weight:700;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.un-peek .sum small{color:var(--muted,#9aa5c8);font-weight:600;font-size:12px}',
    '.un-peek .sum .dmg{color:#ff8ca6}.un-peek .sum .ret{color:#ffd166}.un-peek .sum .kill{color:#06d6a0}',
    '.un-peek .er{flex:1;min-width:0;font-size:13px;color:var(--muted,#9aa5c8)}.un-peek .er b{color:#ff8ca6}',
    '.un-next{display:flex;align-items:center;gap:6px;margin:12px 0 0}',
    '.un-next span{flex:1;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9aa5c8);font-weight:800}',
    // v27: tribe picker, carried unit, stat line
    '.un-tribe{margin:2px 0 8px;min-width:0}',
    '.un-tribe>span{display:block;font-size:11px;font-weight:800;color:var(--muted,#9aa5c8);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}',
    '.un-tribe>div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px}',
    '.un-tribe button{display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid var(--line,#33406e);background:none;color:var(--muted,#9aa5c8);border-radius:999px;padding:0 4px;min-height:30px;font-size:11.5px;font-weight:700;white-space:nowrap;overflow:hidden;min-width:0}',
    '.un-tribe button i{width:9px;height:9px;border-radius:50%;flex:none}',
    '.un-tribe button.on{border-color:#ffd23f;color:var(--text,#e8ecf8);background:rgba(255,210,63,.12)}',
    '.un-carry{display:flex;align-items:center;gap:6px;margin-top:7px}',
    '.un-carry>span{flex:none;font-size:11.5px;font-weight:800;color:var(--muted,#9aa5c8)}',
    '.un-carry .types{flex:1;margin:0;grid-template-columns:repeat(auto-fill,34px)}',
    '.un-stat{display:block;margin-top:6px;font-size:11.5px;color:var(--muted,#9aa5c8);line-height:1.35}',
    '.un-how .un-stat{margin-top:3px}',
    '.un-carry .types{display:grid;gap:3px}',
    '.un-carry .types button{border:1px solid transparent;background:var(--panel2,#252e52);border-radius:9px;padding:2px 0;min-height:34px;display:flex;align-items:center;justify-content:center}',
    '.un-carry .types button.on{border-color:#ffd23f;background:rgba(255,210,63,.16)}',
    '.un-row .l4{display:flex;flex-wrap:wrap;gap:3px 6px;margin-top:5px;font-size:11.5px;color:var(--text,#e8ecf8)}',
    '.un-row .l4 span{background:rgba(255,255,255,.06);border-radius:7px;padding:2px 6px}',
    '.un-boom{flex:none;border:1px solid var(--line,#33406e);background:none;color:var(--muted,#9aa5c8);border-radius:8px;padding:0 7px;min-height:26px;font-size:11.5px;font-weight:700;margin-left:auto}',
    '.un-boom.on{border-color:#ff9f43;color:#ffb36b;background:rgba(255,159,67,.14)}',
    '.un-stx{display:inline-flex;gap:4px;flex-wrap:wrap}',
    '.un-stx button{border:1px solid var(--line,#33406e);background:none;color:var(--muted,#9aa5c8);border-radius:9px;min-height:32px;padding:0 8px;font-size:12px;font-weight:700}',
    '.un-stx button.on{border-color:#7bd94a;color:#b6f08f;background:rgba(123,217,74,.12)}',
    '.un-stx button[data-un=frozen].on{border-color:#9fe3ff;color:#c8f0ff;background:rgba(159,227,255,.12)}',
    '.un-ctl .un-stx{margin-left:auto}',
    // editor popover
    '.un-ed{position:fixed;z-index:60;width:min(350px,calc(100vw - 16px));background:rgba(22,28,52,.98);border:1px solid var(--line,#33406e);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.6);color:var(--text,#e8ecf8);padding:10px;font-size:13.5px;max-height:calc(100dvh - 16px);overflow-y:auto;overscroll-behavior:contain}',
  ].join('\n');
  function injectCss() {
    if (typeof document === 'undefined' || !document.head || document.getElementById('un-style')) return;
    var s = document.createElement('style'); s.id = 'un-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  injectCss();

  // ================================================================ helpers
  var TYPES = ['warrior', 'archer', 'defender', 'rider', 'swordsman', 'catapult', 'knight', 'mindbender', 'giant'];
  function esc(s) {
    if (PP.ui && PP.ui.esc) return PP.ui.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function toast(m, ms) { if (PP.ui && PP.ui.toast) PP.ui.toast(m, ms); }
  function U(type) { return (PP.UNITS && PP.UNITS[type]) || { name: type, hp: 10, atk: 0, def: 0, mov: 1, rng: 1 }; }
  function types() { return TYPES.filter(function (t) { return PP.UNITS && PP.UNITS[t]; }).concat(Object.keys(PP.UNITS || {}).filter(function (t) { return TYPES.indexOf(t) < 0; })); }
  // v27: every side has a tribe (prefs.tribe.me / .enemy); the palette shows that tribe's units
  function tribeOf(side) { var p = uiPrefs(), t = p.tribe && p.tribe[side === 'enemy' ? 'enemy' : 'me']; return PP.TRIBE && PP.TRIBE[t] ? t : 'standard'; }
  function typesFor(side) { return PP.tribeUnits ? PP.tribeUnits(tribeOf(side)) : types(); }
  // types offered when changing a unit: its side's tribe (+ its current type if that comes from another tribe)
  function typesOfUnit(u) { var l = typesFor(u.side); return l.indexOf(u.type) >= 0 ? l : l.concat([u.type]); }
  function carryOpts(u) { return typesFor(u.side).filter(function (k) { return PP.carriable && PP.carriable(k); }); }
  function maxHp(u) { return PP.engine && PP.engine.maxHp ? PP.engine.maxHp(u) : U(u.type).hp + (u.vet ? 5 : 0); }
  function st() { return PP.state; }
  function units() { return (PP.state && PP.state.units) || []; }
  function byId(id) { var us = units(); for (var i = 0; i < us.length; i++) if (us[i].id === id) return us[i]; return null; }
  function unitAt(c, r) { var us = units(); for (var i = 0; i < us.length; i++) if (us[i].c === c && us[i].r === r) return us[i]; return null; }
  function uid() { return PP.util && PP.util.uid ? PP.util.uid() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function dist(a, b) { return PP.grid && PP.grid.dist ? PP.grid.dist(a, b) : Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }
  function canReach(a, t, d) { if (PP.engine && PP.engine.canReach) return PP.engine.canReach(a, t, d); var s = U(a.type); return d <= s.mov + s.rng; }
  function effBonus(t) { return PP.engine && PP.engine.effectiveBonus ? PP.engine.effectiveBonus(t, (PP.state && PP.state.cities) || []) : (t.bonus || 1); }
  function fmt(n) { return String(n); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function isDetected(u) { return u && (u.src === 'auto' || u.src === 'ai'); }
  // keep the chosen attacker sorting applied after every change (taps on the map, HP edits …)
  function commit() { try { autoSort(); } catch (e) { /* ignore */ } if (PP.app && PP.app.commit) PP.app.commit(); }
  function refresh() { if (PP.app && PP.app.refresh) PP.app.refresh(); }
  function redraw() { if (PP.board && PP.board.redraw) PP.board.redraw(); }
  function isActive() { return !!(PP.modes && PP.modes.current === 'units'); }
  function uiPrefs() {
    var s = st(); if (!s) return { side: 'me', brush: null };
    s.ui = s.ui || {};
    var p = s.ui.units || (s.ui.units = {});
    if (p.side !== 'enemy') p.side = 'me';
    if (!p.tribe || typeof p.tribe !== 'object') p.tribe = { me: 'standard', enemy: 'standard' };
    var pal = PP.tribeUnits ? PP.tribeUnits(PP.TRIBE && PP.TRIBE[p.tribe[p.side]] ? p.tribe[p.side] : 'standard') : types();
    if (!(p.brush && PP.UNITS && PP.UNITS[p.brush]) || pal.indexOf(p.brush) < 0) p.brush = pal[0] || 'warrior';
    // sub-mode: Place (default when there are no units) | Battle
    if (!units().length) p.sub = 'place';
    else if (p.sub !== 'place' && p.sub !== 'battle') p.sub = 'battle';
    if (p.selId && !byId(p.selId)) p.selId = null;
    if (p.sub !== 'place') { p.selId = null; p.eraser = false; }
    return p;
  }

  // selection: attackers in tap order, targets (several), active = target shown in the calculator.
  // v13: combat.as = attacking side ('me' default | 'enemy': enemy units attack, own units are the targets).
  // The enemy-perspective selection lives in combat.enemy (core's sanitize() keeps combat.attackers = own units
  // and combat.targets = enemies only), so each perspective keeps its own selection.
  function atkSide() { var cb = st() && st().combat; return cb && cb.as === 'enemy' ? 'enemy' : 'me'; }
  function isAtt(u) { return !!u && (u.side === 'enemy' ? 'enemy' : 'me') === atkSide(); }
  // wording for the current perspective
  function words() {
    return atkSide() === 'enemy'
      ? { att: 'enemy units', tgt: 'your units', tgt1: 'one of your units', tgts: 'your units' }
      : { att: 'your units', tgt: 'enemies', tgt1: 'an enemy', tgts: 'enemies' };
  }
  function sel() {
    var s = st();
    if (!s.combat) s.combat = { attackers: [], targets: [] };
    var root = s.combat;
    if (root.as !== 'enemy') root.as = 'me';
    var cb = root.as === 'enemy' ? (root.enemy && typeof root.enemy === 'object' ? root.enemy : (root.enemy = { attackers: [], targets: [] })) : root;
    cb.attackers = (cb.attackers || []).filter(function (id, i, arr) { var u = byId(id); return u && isAtt(u) && arr.indexOf(id) === i; });
    cb.targets = (cb.targets || []).filter(function (id, i, arr) { var u = byId(id); return u && !isAtt(u) && arr.indexOf(id) === i; });
    if (cb.targets.indexOf(cb.active) < 0) cb.active = cb.targets.length ? cb.targets[cb.targets.length - 1] : null;
    return cb;
  }

  // ================================================================ automatic defense bonus
  // unit.bonusMode 'auto' | 'manual'; unit.bonus = effective value (what PP.engine uses).
  // Auto: city tile (PP.vision.detectCities) → ×1.5, else terrain around the unit (PP.vision.classifyTile on a
  // ring of the tile diamond – the figure covers the centre): forest / mountain / water / ocean → ×1.5.
  // Assumes Archery / Climbing / Aquatism are known; walls can't be seen → user picks ×4.
  var BONUS_TERRAIN = { forest: 'Forest', mountain: 'Mountain', water: 'Water', ocean: 'Ocean' };
  var TECH_OF = { forest: 'Archery', mountain: 'Climbing', water: 'Aquatism', ocean: 'Aquatism' };
  // name-plate colours tried by default: brown (light/dark plates) + dark blue; detected tribe colours are added
  var DEF_TRIBES = [[150, 95, 60], [100, 66, 51], [60, 60, 170]];
  var autoC = { sig: '', terr: {}, cities: null }, pixC = null;
  // v16: descriptive bonus kinds (value + what it is + the tech it needs)
  var KINDS = {
    none: { v: 1, name: 'None', ic: '' },
    forest: { v: 1.5, name: 'Forest', tech: 'Archery', ic: '🌲' },
    mountain: { v: 1.5, name: 'Mountain', tech: 'Climbing', ic: '⛰️' },
    water: { v: 1.5, name: 'Water', tech: 'Aquatism', ic: '🌊' },
    city: { v: 1.5, name: 'City', ic: '🏠' },
    wall: { v: 4, name: 'City Wall', ic: '🧱' }
  };
  var KIND_ORDER = ['none', 'forest', 'mountain', 'water', 'city', 'wall'];
  var KIND_OF_TERRAIN = { forest: 'forest', mountain: 'mountain', water: 'water', ocean: 'water' };
  // plain text: "Forest ×1.5 (Archery)", "City Wall ×4", "None"
  function kindText(k) {
    var K = KINDS[k]; if (!K) return 'None';
    return k === 'none' ? 'None' : K.name + ' ×' + K.v + (K.tech ? ' (' + K.tech + ')' : '');
  }
  // the kind a unit's bonus stands for (legacy units without bonusKind: guessed from the value / auto result)
  function kindOf(u) {
    if (isAuto(u)) return autoValue(u).kind; // v42: no tech → none
    if (KINDS[u.bonusKind] && KINDS[u.bonusKind].v === (u.bonus || 1)) return u.bonusKind;
    var b = u.bonus || 1;
    if (b >= 4) return 'wall';
    if (b <= 1) return 'none';
    var a = autoFor(u.c, u.r);
    return a.v === b && a.kind ? a.kind : null; // null: legacy "×1.5" of unknown kind
  }
  function isAuto(u) { return u.bonusMode === 'auto' || (u.bonusMode == null && !(u.bonus > 1)); }
  function calibrating() { return !!(PP.modes && PP.modes.current === 'calibrate'); }
  function boardImg() { var s = st(); return s && s.board === 'image' && PP.board ? PP.board.image : null; }
  function autoSig() {
    var im = boardImg(), g = st() && st().grid;
    var s = (im ? (im.currentSrc || im.src || 'img').slice(-48) : 'none') + '|' +
      (g ? [g.ox, g.oy, g.ux, g.uy, g.vx, g.vy].map(function (v) { return Math.round(v * 10); }).join(',') : '');
    if (autoC.sig !== s) autoC = { sig: s, terr: {}, cities: null };
    return s;
  }
  function imgPixels(im) {
    if (pixC && pixC.src === im) return pixC;
    try {
      var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, c = document.createElement('canvas');
      c.width = w; c.height = h;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0);
      pixC = { src: im, w: w, h: h, data: x.getImageData(0, 0, w, h).data };
    } catch (e) { pixC = null; }
    return pixC;
  }
  // samples in the outer ring of the tile diamond, left and right of the figure (which stands on the centre
  // and rises upwards); lower tip skipped (often covered by sprites of the tile in front)
  var RING = { a: 0.4, b0: -0.8, b1: 0.15, e: 0.86, N: 22 };
  function ringSamples(c, r) {
    var im = boardImg(), P = im && imgPixels(im), g = st().grid;
    if (!P || !g) return null;
    var ctr = PP.grid.center(c, r), ex = (g.ux - g.vx) / 2, ey = (g.uy - g.vy) / 2, nx = (g.ux + g.vx) / 2, ny = (g.uy + g.vy) / 2;
    var out = [], N = RING.N;
    for (var i = 0; i <= N; i++) {
      for (var j = 0; j <= N; j++) {
        var a = -1 + 2 * i / N, b = -1 + 2 * j / N;
        if (Math.abs(a) + Math.abs(b) > RING.e || Math.abs(a) < RING.a || b < RING.b0 || b > RING.b1) continue;
        var x = Math.floor(ctr.x + a * ex + b * nx), y = Math.floor(ctr.y + a * ey + b * ny);
        if (x < 0 || y < 0 || x >= P.w || y >= P.h) continue;
        var k = (y * P.w + x) * 4;
        out.push([P.data[k], P.data[k + 1], P.data[k + 2]]);
      }
    }
    return out;
  }
  // classify the ring; for land results drop unit/border noise (saturated blue badges & tribe borders, white)
  // and classify again, so a blue figure next to the trees doesn't dilute the forest share
  function classifyRing(c, r) {
    var px = ringSamples(c, r), V = PP.vision;
    if (!px || !px.length || !V || !V.classifyTile) return null;
    var cl = V.classifyTile(px);
    if (!V.hsv || /^(water|ocean|cloud|outside)$/.test(cl.terrain)) return cl;
    var land = px.filter(function (p) {
      var h = V.hsv(p[0], p[1], p[2]);
      return !((h[0] >= 190 && h[0] <= 280 && h[1] > 0.25) || (h[1] < 0.15 && h[2] > 0.8) || h[2] < 0.15);
    });
    return land.length >= px.length * 0.4 ? V.classifyTile(land) : cl;
  }
  function cdist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function detectedCities() {
    if (autoC.cities) return autoC.cities;
    var im = boardImg(), list = [];
    if (im && PP.vision && PP.vision.detectCities) {
      var tr = DEF_TRIBES.slice(), add = function (col) {
        if (Array.isArray(col) && col.length >= 3 && tr.every(function (t) { return cdist3(t, col) > 45; })) tr.push(col.slice(0, 3));
      };
      try { if (PP.recog && PP.recog.tribes) PP.recog.tribes().forEach(function (k) { add(k.color); }); } catch (e) { /* ignore */ }
      add(st().ui && st().ui.myColor);
      try { list = PP.vision.detectCities(im, Object.assign({}, st().grid), tr) || []; } catch (e) { list = []; }
    }
    autoC.cities = list;
    return list;
  }
  // → { v, why, terrain, conf, city }
  function autoFor(c, r) {
    autoSig();
    var k = c + ',' + r;
    if (autoC.terr[k]) return autoC.terr[k];
    var res;
    if (!boardImg()) res = { v: 1, why: 'no screenshot', kind: 'none' };
    else {
      var city = null;
      detectedCities().forEach(function (ci) { if (ci.c === c && ci.r === r && (!city || ci.conf > city.conf)) city = ci; });
      if (city) res = { v: 1.5, why: 'City', terrain: 'city', conf: city.conf, city: true, kind: 'city' };
      else {
        var cl = classifyRing(c, r);
        if (!cl) res = { v: 1, why: 'unknown', kind: 'none' };
        else if (BONUS_TERRAIN[cl.terrain]) res = { v: 1.5, why: BONUS_TERRAIN[cl.terrain], terrain: cl.terrain, conf: cl.conf, tech: TECH_OF[cl.terrain], f: cl.f, kind: KIND_OF_TERRAIN[cl.terrain] };
        else res = { v: 1, why: (PP.TERRAIN && PP.TERRAIN[cl.terrain] ? PP.TERRAIN[cl.terrain].name : cl.terrain), terrain: cl.terrain, conf: cl.conf, f: cl.f, kind: 'none' };
      }
    }
    if (calibrating()) return res; // grid in motion: don't cache
    autoC.terr[k] = res;
    return res;
  }
  // apply auto bonuses (cheap after the first call: cached per image + grid + tile); false while calibrating
  // v42: the terrain bonus needs the tech (Forest: Archery, Mountain: Climbing, Water: Aquatism). Own units: your techs
  // (Costs tool); enemy units: the enemy techs you set here (unknown → no bonus). City / City Wall need no tech.
  function sideHasTech(side, tech) {
    var id = String(tech || '').toLowerCase(); if (!id) return true;
    if (side === 'me') { var b = st().build || {}; return Array.isArray(b.owned) && b.owned.indexOf(id) >= 0; }
    var et = uiPrefs().enemyTech || {}; return !!et[id];
  }
  function autoValue(u) {
    var a = autoFor(u.c, u.r);
    if (a.tech && a.v > 1 && !sideHasTech(u.side, a.tech)) return { v: 1, kind: 'none', noTech: a.tech, a: a };
    return { v: a.v, kind: a.kind || 'none', a: a };
  }
  function toggleTech(side, tech) {
    var id = String(tech).toLowerCase();
    if (side === 'me') { var b = st().build; if (!Array.isArray(b.owned)) b.owned = []; var i = b.owned.indexOf(id); if (i >= 0) b.owned.splice(i, 1); else b.owned.push(id); }
    else { var p = uiPrefs(); p.enemyTech = p.enemyTech || {}; p.enemyTech[id] = !p.enemyTech[id]; }
  }
  function syncAuto() {
    if (!PP.state || calibrating()) return false;
    var ch = false;
    units().forEach(function (u) {
      if (!isAuto(u)) return;
      var a = autoValue(u);
      if (u.bonus !== a.v) { u.bonus = a.v; ch = true; }
      if (u.bonusKind !== a.kind) { u.bonusKind = a.kind; ch = true; }
      if (u.bonusMode !== 'auto') u.bonusMode = 'auto';
    });
    return ch;
  }
  // v = 'auto' | kind name ('forest', 'wall', …) | legacy number
  function setBonus(u, v) {
    if (v === 'auto') { var a = autoValue(u); u.bonusMode = 'auto'; u.bonus = a.v; u.bonusKind = a.kind; return; }
    if (!KINDS[v]) { var n = +v || 1; v = n >= 4 ? 'wall' : n > 1 ? 'city' : 'none'; }
    u.bonusMode = 'manual'; u.bonusKind = v; u.bonus = KINDS[v].v;
  }
  // a city from the city list on the unit's tile overrides the unit's own bonus (PP.engine.effectiveBonus)
  function stateCityAt(u) {
    var list = (st() && st().cities) || [];
    for (var i = 0; i < list.length; i++) if (list[i].c === u.c && list[i].r === u.r) return list[i];
    return null;
  }
  // descriptive effective bonus, e.g. "🌲 Forest ×1.5 (Archery)" – '' when there is none
  function bonusDesc(u) {
    var b = effBonus(u), sc = stateCityAt(u);
    if (!(b > 1)) return '';
    if (sc && b === (sc.walls ? 4 : 1.5)) return (sc.walls ? KINDS.wall.ic + ' ' + kindText('wall') : KINDS.city.ic + ' ' + kindText('city')) + ' (city list)';
    var k = kindOf(u);
    return k ? (KINDS[k].ic ? KINDS[k].ic + ' ' : '') + kindText(k) : '×' + fmt(b);
  }

  // ================================================================ glyphs (line icons, -50..50 box)
  // v10: fine line icons drawn in white with round caps. part: d (SVG path), w stroke width (box units),
  // fl = faint white fill alpha (gives outlines a little body), dot = small filled detail,
  // rot (deg) / tx, ty (applied as rotate(rot) translate(tx,ty))
  var CIRC = function (cx, cy, r) { return 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0Z'; };
  var SWORD = [
    { d: 'M0 -44V6', w: 7 },
    { d: 'M-15 7H15', w: 6 },
    { d: 'M0 8V26', w: 6 },
    { d: CIRC(0, 33, 4.5), dot: 1 }
  ];
  function rotParts(parts, rot, tx, ty) { return parts.map(function (p) { return Object.assign({}, p, { rot: rot, tx: tx || 0, ty: ty || 0 }); }); }
  var GLYPHS = {
    warrior: rotParts(SWORD, 45, 0, 4),
    swordsman: rotParts(SWORD, -40, 0, 8).concat(rotParts(SWORD, 40, 0, 8)),
    archer: [
      { d: 'M-14 -40C28 -30 28 30 -14 40', w: 6 },
      { d: 'M-14 -40L-14 40', w: 2.5 },
      { d: 'M-40 0L34 0', w: 4.5 },
      { d: 'M22 -10L38 0L22 10', w: 5.5 },
      { d: 'M-42 -9L-33 0L-42 9', w: 3.5 }
    ].map(function (p) { return Object.assign(p, { rot: -40 }); }),
    defender: [
      { d: 'M0 -42C11 -35 22 -32 33 -32C33 5 23 28 0 42C-23 28 -33 5 -33 -32C-22 -32 -11 -35 0 -42Z', w: 6, fl: 0.16 },
      { d: 'M0 -21V21M-14 -5H14', w: 5 }
    ],
    rider: [
      { d: 'M2 -44L11 -29C27 -23 36 -4 34 19L36 42L-2 42C1 29 -1 20 -9 14L-28 17C-38 19 -45 10 -40 1L-25 -21C-19 -29 -10 -33 -2 -31Z', w: 5.5, fl: 0.16 },
      { d: 'M12 -26C23 -18 28 -3 26 19', w: 3 },
      { d: CIRC(-13, -13, 4.2), dot: 1 }
    ],
    catapult: [
      { d: 'M-22 14L20 -24', w: 6 },
      { d: CIRC(27, -32, 8), w: 5, fl: 0.35 },
      { d: 'M-8 15L4 -5L16 15', w: 4.5 },
      { d: 'M-38 16H38', w: 6 },
      { d: CIRC(-22, 31, 8.5) + CIRC(22, 31, 8.5), w: 5 }
    ],
    knight: [
      { d: 'M-28 40V-4C-28 -28 -15 -40 0 -40C15 -40 28 -28 28 -4V40H7V6H20V-4H-20V6H-7V40Z', w: 5.5, fl: 0.16 },
      { d: 'M0 -40C4 -50 22 -54 36 -44', w: 5 }
    ],
    mindbender: [
      { d: 'M0 -27V-42M-21 -21L-30 -33M21 -21L30 -33', w: 4.5 },
      { d: 'M-44 4C-26 -24 26 -24 44 4C26 32 -26 32 -44 4Z', w: 6, fl: 0.12 },
      { d: CIRC(0, 4, 12), w: 5 },
      { d: CIRC(0, 4, 5), dot: 1 }
    ],
    giant: [
      { d: 'M-32 0V-20A8 8 0 0 1 -16 -20A8 8 0 0 1 0 -20A8 8 0 0 1 16 -20A8 8 0 0 1 32 -20V18C32 32 22 42 8 42H-12C-26 42 -32 32 -32 20Z', w: 6, fl: 0.16 },
      { d: 'M-16 -20V-4M0 -20V-4M16 -20V-4', w: 4 },
      { d: 'M-32 4C-24 -2 -14 0 -6 4L10 10C18 13 16 22 8 22H-14', w: 4.5 }
    ]
  };
  var FALLBACK_GLYPH = [{ d: CIRC(0, 0, 18), w: 6 }];
  function glyph(type) { return GLYPHS[type] || FALLBACK_GLYPH; }

  // side colours: ring, translucent tint inside the dark disc
  var PAL = {
    me: { ring: '#5aa9ff', tint: '64,140,255', dark: '#0d1f45' },
    enemy: { ring: '#ff5c74', tint: '255,72,100', dark: '#45101b' }
  };
  var LIGHT = '#ffffff';
  var DISC = 'rgba(10,14,28,';
  var FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  var p2d = {};
  function path(d) { if (!p2d[d] && typeof Path2D !== 'undefined') p2d[d] = new Path2D(d); return p2d[d]; }

  // ================================================================ coin drawing (canvas, screen space)
  function tileW() {
    var ts = PP.board && PP.board.tileScreenSize ? PP.board.tileScreenSize() : { w: 60, h: 36 };
    return ts.w || 60;
  }
  // v12: small badge – radius ≈ 0.165 × tile width, clamped 6…18 px (drawn at full R, DR = 1)
  function coinR() { return clamp(tileW() * 0.165, 6, 18); }
  // tap radius around the coin (comfortable even when the coin is tiny); taps elsewhere on the unit's tile also hit
  function hitR() { return Math.max(coinR() + 7, 16); }
  var DR = 1, GK = 0.7; // drawn disc radius / R, glyph size / disc radius (legacy line glyphs)
  var ICON_K = 1.5;     // PP.icons box edge / disc radius
  // v12: coin centre on the FIGURE: Polytopia figures stand on the tile centre and rise upwards; measured on real
  // screenshots their visual centre sits ≈ 0.12 (warrior) … 0.27 (rider) tile heights above the tile centre
  var COIN_DY = -0.2;
  function tileH() { var ts = PP.board.tileScreenSize ? PP.board.tileScreenSize() : { h: 0 }; return ts.h || 0; }
  function cpos(c, r) {
    var p = PP.board.tileToScreen(c, r);
    return { x: p.x, y: p.y + tileH() * COIN_DY };
  }
  function useIcons(type) { return !!(PP.icons && PP.icons.has && PP.icons.has(type)); }

  // white line icon; Rd = disc radius (px). Dark halo first, then the strokes, so it reads on any background.
  function drawGlyph(ctx, type, x, y, Rd) {
    if (useIcons(type)) {
      PP.icons.draw(ctx, type, x, y, Rd * ICON_K, { stroke: 'rgba(0,0,0,.42)', strokeWidth: clamp(Rd * 0.06, 0.6, 1.6) });
      return;
    }
    var parts = glyph(type), k = Rd * GK / 46, halo = clamp(Rd * 0.07, 0.9, 2.2);
    ctx.save();
    ctx.translate(x, y); ctx.scale(k, k);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      parts.forEach(function (p) {
        var P = path(p.d); if (!P) return;
        ctx.save();
        if (p.rot) ctx.rotate(p.rot * Math.PI / 180);
        if (p.tx || p.ty) ctx.translate(p.tx || 0, p.ty || 0);
        var lw = p.dot ? 0 : Math.max(p.w * k, p.w < 4 ? 0.7 : 1.05) / k;
        if (pass === 0) {
          ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = lw + 2 * halo / k;
          ctx.stroke(P);
        } else {
          if (p.fl) { ctx.fillStyle = 'rgba(255,255,255,' + p.fl + ')'; ctx.fill(P); }
          if (p.dot) { ctx.fillStyle = LIGHT; ctx.fill(P); }
          else { ctx.strokeStyle = LIGHT; ctx.lineWidth = lw; ctx.stroke(P); }
        }
        ctx.restore();
      });
    }
    ctx.restore();
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  }
  // slim pill label (HP, predictions, "?")
  function chip(ctx, x, y, text, fs, bg, fg, border) {
    ctx.save();
    ctx.font = '700 ' + fs + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = Math.max(fs * 1.3, ctx.measureText(text).width + fs * 0.6), h = fs * 1.3;
    rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(1.5, fs * 0.3); ctx.shadowOffsetY = fs * 0.06;
    ctx.fillStyle = bg; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(0.8, fs * 0.09); ctx.strokeStyle = border || 'rgba(255,255,255,.7)'; ctx.stroke();
    ctx.fillStyle = fg || '#fff';
    ctx.fillText(text, x, y + fs * 0.05);
    ctx.restore();
    return w;
  }
  function star(ctx, x, y, r, fill) {
    ctx.save(); ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.lineWidth = Math.max(0.9, r * 0.22); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(30,20,0,.85)'; ctx.stroke();
    ctx.fillStyle = fill || '#ffd23f'; ctx.fill();
    ctx.restore();
  }
  function shieldMark(ctx, x, y, r, walls) {
    if (walls) return wallMark(ctx, x, y, r);
    ctx.save(); ctx.translate(x, y); ctx.scale(r / 40, r / 40);
    var P = path(GLYPHS.defender[0].d), s = 40 / r;
    ctx.lineJoin = 'round';
    ctx.fillStyle = DISC + '.9)'; ctx.fill(P);
    ctx.lineWidth = Math.max(1, r * 0.2) * s; ctx.strokeStyle = walls ? '#f0c27a' : '#cfe3ff'; ctx.stroke(P);
    ctx.restore();
  }

  // v16: City Wall ×4 → tiny crenellated wall (instead of the shield)
  function wallMark(ctx, x, y, r) {
    var w = r * 1.05, h = r * 0.95, m = h * 0.32, t = w / 2.5;
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-w, h); ctx.lineTo(-w, -h);
    for (var i = 1; i <= 4; i++) { var xi = -w + i * t; ctx.lineTo(xi, i % 2 ? -h : -h + m); ctx.lineTo(xi, i % 2 ? -h + m : -h); }
    ctx.lineTo(w, -h); ctx.lineTo(w, h); ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.fillStyle = DISC + '.9)'; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.2); ctx.strokeStyle = '#f0c27a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.6, h * 0.25); ctx.lineTo(w * 0.6, h * 0.25);
    ctx.lineWidth = Math.max(0.6, r * 0.12); ctx.stroke();
    ctx.restore();
  }

  // full token at (x,y) with radius R (hit radius; the disc is drawn at R·DR). o: { alpha, hp (text override) }
  // v10: isometric ground ellipse on the tile + a floating dark glass disc with a thin ring in the side colour,
  // white line glyph, small HP pill
  function drawCoin(ctx, u, x, y, R, o) {
    o = o || {};
    var side = u.side === 'enemy' ? 'enemy' : 'me', pal = PAL[side], Rd = R * DR;
    var rw = clamp(R * 0.09, 1.1, 2);
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    // v12: faint ground ellipse at the figure's feet (tile centre), so the floating badge reads as belonging to
    // that tile
    if (o.foot) {
      var gx = Math.max(Rd * 1.25, tileW() * 0.2), gyR = gx * 0.6;
      ctx.beginPath(); ctx.ellipse(o.foot.x, o.foot.y, gx, gyR, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = pal.ring; ctx.globalAlpha *= 0.55; ctx.stroke();
      ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    }
    // disc with soft shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = Math.max(1.5, R * 0.3); ctx.shadowOffsetY = Math.max(0.5, R * 0.08);
    var g = ctx.createRadialGradient(x, y - Rd * 0.3, Rd * 0.05, x, y, Rd);
    g.addColorStop(0, 'rgba(' + pal.tint + ',.42)'); g.addColorStop(1, 'rgba(' + pal.tint + ',.14)');
    ctx.beginPath(); ctx.arc(x, y, Rd, 0, Math.PI * 2);
    ctx.fillStyle = DISC + '.7)'; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, Rd, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    // ring: dark hairline outside for contrast on snow / light tiles, then the side colour, then a fine highlight
    ctx.lineWidth = rw + 1.4; ctx.strokeStyle = 'rgba(0,0,0,.42)'; ctx.stroke();
    ctx.lineWidth = rw; ctx.strokeStyle = pal.ring; ctx.stroke();
    if (R >= 12) {
      // fine bezel: hairline inside the ring + a short highlight arc
      var ri = Rd - rw * 0.5 - Math.max(1.2, R * 0.07);
      ctx.beginPath(); ctx.arc(x, y, ri, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.6, R * 0.022); ctx.strokeStyle = pal.ring; ctx.globalAlpha *= 0.55; ctx.stroke();
      ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
      ctx.beginPath(); ctx.arc(x, y, Rd + rw * 0.5 + Math.max(0.5, R * 0.02), Math.PI * 1.15, Math.PI * 1.6);
      ctx.lineWidth = Math.max(0.6, R * 0.025); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineCap = 'round'; ctx.stroke();
    }
    // tribe colour (detected units) as a fine inner ring
    if (Array.isArray(u.color) && u.color.length >= 3 && R >= 11) {
      ctx.beginPath(); ctx.arc(x, y, Rd - rw - Math.max(1, R * 0.06), 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.9, R * 0.045); ctx.strokeStyle = 'rgb(' + u.color.slice(0, 3).map(function (v) { return v | 0; }).join(',') + ')'; ctx.stroke();
    }
    drawGlyph(ctx, u.type, x, y, Rd);
    // HP (small pill, lower right)
    var mx = maxHp(u), fs = clamp(R * 0.55, 6, 9.5), hurt = u.hp < mx;
    // v12: tiny coins (zoomed out) only show the HP when the unit is hurt, and skip the bonus shield
    if (hurt || R >= 10 || o.hp != null) chip(ctx, x + Rd * 0.95 + fs * 0.25, y + Rd * 0.72, o.hp != null ? String(o.hp) : String(u.hp), fs,
      DISC + '.9)', hurt ? (u.hp <= mx / 3 ? '#ff7088' : '#ffc061') : '#fff', hurt ? (u.hp <= mx / 3 ? '#ff4d6d' : '#f5a524') : 'rgba(255,255,255,.35)');
    // tiny marks: veteran star (upper right), shield when the defense bonus is > 1 (lower left)
    if (u.vet) star(ctx, x + Rd * 0.85, y - Rd * 0.8, clamp(R * 0.36, 3, 6.5));
    // v27: status dots upper left – green = poisoned, ice blue = frozen
    if (R >= 8) [u.poison ? '#7bd94a' : null, u.frozen ? '#9fe3ff' : null].filter(Boolean).forEach(function (col, i) {
      var dr = clamp(R * 0.2, 2.2, 4), dx = x - Rd * 0.85 + i * dr * 2.2, dy = y - Rd * 0.8;
      ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = Math.max(0.8, dr * 0.35); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.stroke();
    });
    var b = effBonus(u);
    if (b > 1 && R >= 9) shieldMark(ctx, x - Rd * 0.95, y + Rd * 0.7, clamp(R * 0.4, 3.2, 6.5), b >= 4);
    if (isDetected(u) && typeof u.conf === 'number' && u.conf < 0.6) chip(ctx, x - Rd * 0.9, y - Rd * 0.85, '?', clamp(R * 0.55, 6, 10), '#ffaa00', '#1d1a10', 'rgba(40,25,0,.8)');
    ctx.restore();
  }

  // ================================================================ coin SVG (drawer previews)
  function coinSvg(type, side, px) {
    side = side === 'enemy' ? 'enemy' : 'me';
    var pal = PAL[side], Rd = 42, k = Rd * GK / 46, upx = px / 104 * k; // css px per glyph unit
    if (useIcons(type)) {
      var rw0 = Math.max(3.6, 1.15 * 104 / px), isz = Rd * ICON_K, ic = PP.icons.svg(type, isz, { stroke: 'rgba(0,0,0,.35)', strokeWidth: 0.6 * 104 / px });
      return '<svg width="' + px + '" height="' + px + '" viewBox="-52 -52 104 104" aria-hidden="true">' +
        '<circle r="' + Rd + '" fill="' + DISC + '.8)"/>' +
        '<circle r="' + Rd + '" fill="rgba(' + pal.tint + ',.26)" stroke="' + pal.ring + '" stroke-width="' + rw0.toFixed(2) + '"/>' +
        '<g transform="translate(' + (-isz / 2) + ' ' + (-isz / 2) + ')">' + ic.replace('<svg ', '<svg x="0" y="0" ') + '</g></svg>';
    }
    var parts = glyph(type), halo = '', body = '';
    parts.forEach(function (p) {
      var tf = (p.rot ? 'rotate(' + p.rot + ')' : '') + (p.tx || p.ty ? ' translate(' + (p.tx || 0) + ' ' + (p.ty || 0) + ')' : '');
      var t = tf ? ' transform="' + tf + '"' : '';
      var w = p.dot ? 0 : Math.max(p.w, (p.w < 4 ? 0.7 : 1.05) / upx);
      halo += '<path d="' + p.d + '"' + t + ' fill="none" stroke="#000" stroke-opacity=".45" stroke-width="' + (w + 1.6 / upx).toFixed(2) + '"/>';
      body += '<path d="' + p.d + '"' + t + ' fill="' + (p.dot ? LIGHT : p.fl ? 'rgba(255,255,255,' + p.fl + ')' : 'none') + '"' +
        (p.dot ? '' : ' stroke="' + LIGHT + '" stroke-width="' + w.toFixed(2) + '"') + '/>';
    });
    var rw = Math.max(3.6, 1.15 * 104 / px);
    return '<svg width="' + px + '" height="' + px + '" viewBox="-52 -52 104 104" aria-hidden="true">' +
      '<circle r="' + Rd + '" fill="' + DISC + '.8)"/>' +
      '<circle r="' + Rd + '" fill="rgba(' + pal.tint + ',.26)" stroke="' + pal.ring + '" stroke-width="' + rw.toFixed(2) + '"/>' +
      '<g transform="scale(' + k.toFixed(4) + ')" stroke-linejoin="round" stroke-linecap="round">' + halo + body + '</g></svg>';
  }

  // ================================================================ damage calculation
  function defCheck(a, t, d) { return canReach(a, t, d) ? '' : 'out of range (distance ' + d + ')'; }
  // enemies (= the defending side) on the 8 tiles around x, without the ids in `skip`
  function enemiesAround(x, skip) {
    return units().filter(function (o) { return !isAtt(o) && skip.indexOf(o.id) < 0 && dist(o, x) === 1; });
  }
  function cp(u, o) { return Object.assign({}, u, o); }
  // v27: one target, attackers in order – with the unit skills (see PP.SKILL_INFO). Side effects on other enemies
  // (splash, explosions) are collected in res.fx; target status (poisoned, frozen, converted) in res.
  function simulate(t, order) {
    var E = PP.engine, tb = effBonus(t), hp = t.hp, tPois = !!t.poison, tFroz = !!t.frozen, conv = false;
    var steps = [], killedAt = 0, losses = [], ex = {};
    var exOf = function (x) { return ex[x.id] || (ex[x.id] = { u: x, before: x.hp, hp: x.hp, poison: !!x.poison, b: effBonus(x) }); };
    var hitOther = function (a, aHp, x, kind, poison) {
      var e = exOf(x); if (e.hp <= 0) return null;
      var dm = E.splash(cp(a, { hp: aHp }), cp(x, { hp: e.hp, bonus: e.b, poison: e.poison }));
      e.hp = Math.max(0, e.hp - dm); if (poison && e.hp > 0) e.poison = true;
      return { u: x, dmg: dm, after: e.hp, kind: kind, poison: !!(poison && e.hp > 0) };
    };
    order.forEach(function (a, i) {
      var A = U(a.type), d = dist(a, t), w = defCheck(a, t, d), s = { a: a, n: i + 1, d: d, far: !!w, warn: w, fx: [] };
      if (!((A.atk > 0 || A.convert || A.freeze) && a.hp > 0) || a.frozen) { s.none = true; s.why = a.frozen ? 'frozen – can\'t attack' : 'can\'t attack'; steps.push(s); return; }
      if (hp <= 0 || conv) { s.skipped = true; steps.push(s); return; }
      var aHp = a.hp, boom = !!A.explode && (!A.boomOpt || !!a.boom), melee = boom || A.rng <= 1;
      s.tBefore = hp; s.aBefore = a.hp;
      // Tentacles: a melee attacker that moves next to the target is hit first (half damage)
      if (U(t.type).tentacles && !tFroz && melee && d > 1) {
        var z = E.half(cp(t, { hp: hp }), cp(a, { bonus: effBonus(a) }));
        if (z > 0) { s.zap = z; aHp = Math.max(0, aHp - z); }
      }
      // Stomp: moving next to the target damages it (and every other enemy next to the new tile)
      if (A.stomp && d > 1 && aHp > 0) {
        var sd = E.half(cp(a, { hp: aHp }), cp(t, { hp: hp, bonus: tb, poison: tPois }));
        if (sd > 0) { s.stomp = sd; hp = Math.max(0, hp - sd); }
        s.note = 'Stomp also hits other enemies next to its new tile';
      }
      var aHp0 = aHp, dmg = 0, ret = 0;
      if (aHp > 0 && hp > 0) {
        for (var h = 0; h < (A.double ? 2 : 1) && hp > 0 && aHp > 0; h++) {
          var r = E.attack(cp(a, { hp: aHp }), cp(t, { hp: hp, bonus: tb, poison: tPois, frozen: tFroz }), d, { boom: boom });
          dmg += r.dmg; ret += r.ret; hp = r.defHp; aHp = r.attHp;
          if (r.poison) { tPois = true; s.poison = true; }
          if (r.freeze) { tFroz = true; s.freeze = true; }
          if (r.convert) { conv = true; s.convert = true; }
          if (r.poisonAtt) s.poisonAtt = true;
          if (r.explode) s.boom = true;
          if (h === 1) s.double = true;
        }
      }
      // Splash: enemies next to the target take half damage (Exida: poison only)
      if (A.splash && !s.freeze && !s.convert && aHp0 > 0) {
        enemiesAround(t, [t.id, a.id]).forEach(function (x) {
          if (A.poison) { var e = exOf(x); if (e.hp > 0 && !e.poison) { e.poison = true; s.fx.push({ u: x, dmg: 0, after: e.hp, kind: 'splash', poison: true }); } }
          else { var f = hitOther(a, aHp0, x, 'splash', false); if (f && f.dmg) s.fx.push(f); }
        });
      }
      // Explosion: every enemy next to the exploding unit (known when it already stands next to the target)
      if (s.boom) {
        if (d <= 1) enemiesAround(a, [t.id, a.id]).forEach(function (x) { var f = hitOther(a, aHp0, x, 'explode', true); if (f) s.fx.push(f); });
        else s.note = 'The explosion also hits other enemies next to the tile where it explodes';
      }
      s.dmg = dmg; s.ret = ret; s.tAfter = hp; s.aAfter = aHp;
      if (hp <= 0 && !killedAt) { killedAt = i + 1; if (A.persist) s.persist = true; }
      if (s.aAfter <= 0) losses.push(a);
      steps.push(s);
    });
    var fx = Object.keys(ex).map(function (k) { return ex[k]; }).filter(function (e) { return e.hp !== e.before || e.poison !== !!e.u.poison; });
    return { t: t, bonus: tb, steps: steps, hpAfter: hp, killedAt: killedAt, losses: losses, converted: conv, poison: tPois && hp > 0, frozen: tFroz && hp > 0, fx: fx,
      used: steps.filter(function (s) { return s.dmg != null; }).length };
  }
  function done(res) { return res.hpAfter <= 0 || !!res.converted; }
  function calcFor(t) {
    if (!t || !PP.engine || !PP.engine.attack) return null;
    return simulate(t, sel().attackers.map(byId).filter(Boolean));
  }
  function calc() { return PP.state ? calcFor(byId(sel().active)) : null; }
  // v13: city on the target's tile? state city > detected name plate (auto bonus) > manual ×4 (walls)
  function cityAt(t) {
    var list = (st() && st().cities) || [];
    for (var i = 0; i < list.length; i++) if (list[i].c === t.c && list[i].r === t.r) return { name: list[i].name || '', walls: !!list[i].walls };
    var a = autoFor(t.c, t.r), k = isAuto(t) ? null : kindOf(t);
    if (k === 'wall') return { name: '', walls: true };
    if (k === 'city' || (a.city && (isAuto(t) || k == null))) return { name: '', walls: false };
    return null;
  }
  // "City falls?": yes if the defender dies and a surviving melee attacker (range 1) next to the city (distance 1)
  // can move in → { yes, why, own (the city belongs to me), a } or null (no city / no attack)
  function cityVerdict(res) {
    if (!res || !res.used || !res.t) return null;
    var ci = cityAt(res.t); if (!ci) return null;
    var out = { own: res.t.side !== 'enemy', city: ci };
    if (res.converted) { out.yes = false; out.why = U(res.t.type).name + ' is converted – it now stands in the city for the attacker'; return out; }
    if (res.hpAfter > 0) { out.yes = false; out.why = U(res.t.type).name + ' survives with ' + res.hpAfter + ' HP'; return out; }
    var cand = null, melee = false, adj = false;
    res.steps.forEach(function (s) {
      if (s.none) return;
      var a = s.a, m = (U(a.type).rng || 1) <= 1, alive = s.skipped ? a.hp > 0 : s.aAfter > 0;
      if (!m) return;
      melee = true;
      if (s.d !== 1) return;
      adj = true;
      if (alive && (!cand || s.n === res.killedAt)) cand = s;
    });
    if (cand) {
      out.yes = true; out.a = cand.a;
      out.why = U(cand.a.type).name + (cand.n === res.killedAt ? ' kills and moves in' : ' (next to it) can move in');
    } else {
      out.yes = false;
      out.why = !melee ? 'defender dies, but only ranged attackers – none moves in'
        : !adj ? 'defender dies, but no melee attacker is next to the city'
          : 'defender dies, but the melee attackers next to it die too';
    }
    return out;
  }
  function verdictHtml(v) {
    if (!v) return '';
    var cls = v.yes ? (v.own ? 'bad' : 'good') : 'hold';
    return '<div class="un-res ' + cls + '" style="margin-top:4px" data-city="' + (v.yes ? 'yes' : 'no') + '">🏰 City falls? <b>' + (v.yes ? 'YES' : 'NO') + '</b>' +
      '<small>' + esc(v.why) + (v.city && v.city.walls ? ' · City Wall ×4' : '') + '</small></div>';
  }
  function score(res) {
    var taken = 0, used = 0, dealt = 0;
    res.steps.forEach(function (s) { if (s.dmg != null) { used++; taken += s.aBefore - Math.max(0, s.aAfter); dealt += s.tBefore - s.tAfter; } });
    (res.fx || []).forEach(function (e) { dealt += e.before - e.hp; });
    return [done(res) ? 1 : 0, -res.losses.length, -taken, -used, dealt];
  }
  function better(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; }
  // Sorting criteria for the attack order (Battle): the chosen one stays active and re-sorts automatically.
  var SORTS = [['dmg', 'Max damage'], ['units', 'Fewest units'], ['safe', 'Least damage taken']];
  function scoreBy(res, by) {
    var taken = 0, used = 0, dealt = 0;
    res.steps.forEach(function (s) { if (s.dmg != null) { used++; taken += s.aBefore - Math.max(0, s.aAfter); dealt += s.tBefore - s.tAfter; } });
    (res.fx || []).forEach(function (e) { dealt += e.before - e.hp; });
    var kill = done(res) ? 1 : 0, need = kill ? res.killedAt : 99, loss = res.losses.length;
    if (by === 'dmg') return [dealt, kill, -loss, -taken, -used];       // most damage to the target
    if (by === 'units') return [kill, -need, -loss, -taken, dealt];    // kill with as few attacks as possible
    return [-taken, -loss, kill, dealt, -used];                         // 'safe': least total damage taken (a lost unit counts its full HP)
  }
  function sortedOrder(by) {
    var cb = sel(), t = byId(cb.active), list = cb.attackers.map(byId).filter(Boolean);
    if (!t || list.length < 2 || list.length > 7 || !PP.engine || !PP.engine.attack) return null;
    // start from the current order, so ties keep it (no jumping around)
    var best = list.slice(), bestS = scoreBy(simulate(t, list), by);
    (function perm(pre, rest) {
      if (!rest.length) { var s = scoreBy(simulate(t, pre), by); if (better(s, bestS)) { bestS = s; best = pre.slice(); } return; }
      for (var i = 0; i < rest.length; i++) perm(pre.concat([rest[i]]), rest.slice(0, i).concat(rest.slice(i + 1)));
    })([], list);
    return best.map(function (u) { return u.id; });
  }
  function autoSort() {
    var p = uiPrefs(); if (!p.sortBy || p.sub !== 'battle') return;
    var o = sortedOrder(p.sortBy), cb = sel();
    if (o && o.join(',') !== cb.attackers.join(',')) cb.attackers = o;
  }
  function sortHtml() {
    var p = uiPrefs(), cb = sel();
    if (!cb.active || cb.attackers.length < 2) return '';
    return '<div class="un-sort"><span>Sort attackers</span><div>' + SORTS.map(function (x) {
      return '<button data-un="sort" data-v="' + x[0] + '" class="' + (p.sortBy === x[0] ? 'on' : '') + '" aria-pressed="' + (p.sortBy === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div></div>';
  }
  function bestOrder() {
    var cb = sel(), t = byId(cb.active), list = cb.attackers.map(byId).filter(Boolean);
    if (!t || list.length < 2 || list.length > 7 || !PP.engine || !PP.engine.attack) return null;
    var best = null, bestS = null, cur = score(simulate(t, list));
    (function perm(pre, rest) {
      if (!rest.length) {
        var s = score(simulate(t, pre));
        if (!bestS || better(s, bestS)) { bestS = s; best = pre.slice(); }
        return;
      }
      for (var i = 0; i < rest.length; i++) perm(pre.concat([rest[i]]), rest.slice(0, i).concat(rest.slice(i + 1)));
    })([], list);
    return best && better(bestS, cur) ? best.map(function (u) { return u.id; }) : null;
  }

  // ================================================================ v32 best attack sequence (several targets)
  // Which attacker attacks which target, and in which order. Every attacker attacks at most once. Goal, in this order:
  // most targets defeated, fewest own units lost, least damage taken, most damage dealt, fewest attacks used.
  // Per target: the best order for every set of attackers that can reach it (all orders up to 6 attackers; a set is
  // skipped if a smaller one already defeats the target). Then the best split of the attackers over the targets (DP).
  // Targets are computed one by one on the current HP (splash on another target is not carried over).
  var SEQ_MAX_A = 8, SEQ_MAX_T = 5, SEQ_PERM = 6;
  var seq = null; // { sig, side, state: 'running'|'done'|'too', plan: [{ t, order: [units], res }], tot, ms, pct }
  function seqSig() {
    var cb = sel();
    return JSON.stringify([atkSide(), cb.attackers, cb.targets, units().map(function (u) {
      return [u.id, u.c, u.r, u.hp, u.type, u.side, !!u.vet, u.bonus, u.bonusMode, !!u.poison, !!u.frozen, !!u.boom, u.carry || ''];
    })]);
  }
  function seqNow() { return seq && seq.sig === seqSig() ? seq : null; }
  function seqVal(res) {
    var taken = 0, used = 0, dealt = 0;
    res.steps.forEach(function (s) { if (s.dmg != null) { used++; taken += s.aBefore - Math.max(0, s.aAfter); dealt += s.tBefore - s.tAfter; } });
    (res.fx || []).forEach(function (e) { dealt += e.before - e.hp; });
    return [done(res) ? 1 : 0, -res.losses.length, -taken, dealt, -used];
  }
  function vAdd(a, b) { return a.map(function (x, i) { return x + b[i]; }); }
  var V0 = [0, 0, 0, 0, 0];
  function bits(m) { var c = 0; for (; m; m &= m - 1) c++; return c; }
  function startSeq() {
    var cb = sel(), A = cb.attackers.map(byId).filter(Boolean), T = cb.targets.map(byId).filter(Boolean);
    var me = seq = { sig: seqSig(), state: 'running', pct: 0, t0: Date.now(), show: true };
    if (A.length > SEQ_MAX_A || T.length > SEQ_MAX_T || !PP.engine || !PP.engine.attack) { me.state = 'too'; me.nA = A.length; me.nT = T.length; refresh(); return; }
    var n = A.length, m = T.length, best = [], reach = T.map(function (t) {
      var r = 0; A.forEach(function (a, i) { if ((U(a.type).atk > 0 || U(a.type).convert || U(a.type).freeze) && canReach(a, t, dist(a, t))) r |= 1 << i; }); return r;
    });
    // work list: per target, the subsets of its reachable attackers by size
    var jobs = [];
    T.forEach(function (t, ti) {
      best[ti] = {}; best[ti][0] = { v: V0, order: [] };
      var subs = []; for (var sm = reach[ti]; sm; sm = (sm - 1) & reach[ti]) subs.push(sm);
      subs.sort(function (a, b) { return bits(a) - bits(b); });
      subs.forEach(function (sm) { jobs.push([ti, sm]); });
    });
    var ji = 0, total = jobs.length || 1;
    var evalSet = function (ti, sm) {
      var t = T[ti], idx = []; for (var i = 0; i < n; i++) if (sm & (1 << i)) idx.push(i);
      // a smaller set that already defeats the target makes this one pointless (the extra attacker stays free)
      for (var k = 0; k < idx.length; k++) { var sub = best[ti][sm & ~(1 << idx[k])]; if (sub && sub.v[0] === 1) return; }
      var bv = null, bo = null, tryOrder = function (o) {
        var r = simulate(t, o.map(function (i) { return A[i]; })), v = seqVal(r);
        if (!bv || better(v, bv)) { bv = v; bo = o.slice(); }
      };
      if (idx.length <= SEQ_PERM) {
        (function perm(pre, rest) {
          if (!rest.length) { tryOrder(pre); return; }
          for (var q = 0; q < rest.length; q++) perm(pre.concat([rest[q]]), rest.slice(0, q).concat(rest.slice(q + 1)));
        })([], idx);
      } else {
        // big set: best order of the set without one attacker, that attacker put first or last
        idx.forEach(function (i) { var b = best[ti][sm & ~(1 << i)]; if (b) { tryOrder([i].concat(b.order)); tryOrder(b.order.concat([i])); } });
        if (!bo) tryOrder(idx);
      }
      best[ti][sm] = { v: bv, order: bo };
    };
    var finish = function () {
      // DP over the targets: F[ti][mask] = best total of targets ti… with the attackers in mask
      var full = (1 << n) - 1, F = [], C = [];
      for (var ti = m; ti >= 0; ti--) { F[ti] = new Array(full + 1); C[ti] = new Array(full + 1); }
      for (var mk = 0; mk <= full; mk++) F[m][mk] = V0;
      for (ti = m - 1; ti >= 0; ti--) {
        for (mk = 0; mk <= full; mk++) {
          var bv = null, bs = 0, opts = mk & reach[ti];
          for (var sm = opts; ; sm = (sm - 1) & opts) {
            var b = best[ti][sm];
            if (b) { var v = vAdd(b.v, F[ti + 1][mk & ~sm]); if (!bv || better(v, bv)) { bv = v; bs = sm; } }
            if (!sm) break;
          }
          F[ti][mk] = bv; C[ti][mk] = bs;
        }
      }
      var plan = [], left = full;
      for (ti = 0; ti < m; ti++) {
        var smk = C[ti][left], o = best[ti][smk].order;
        left &= ~smk;
        if (!o.length) { plan.push({ t: T[ti], order: [], res: null }); continue; }
        var ord = o.map(function (i) { return A[i]; }), r = simulate(T[ti], ord);
        // attackers after the deciding blow are not needed
        if (r.killedAt && r.killedAt < ord.length) { ord = ord.slice(0, r.killedAt); r = simulate(T[ti], ord); }
        plan.push({ t: T[ti], order: ord, res: r });
      }
      // defeated targets first, then the others
      plan.sort(function (a, b) { return (b.res && done(b.res) ? 1 : 0) - (a.res && done(a.res) ? 1 : 0); });
      var tot = { kills: 0, losses: 0, taken: 0, used: 0 };
      plan.forEach(function (p) { if (!p.res) return; var v = seqVal(p.res); tot.kills += v[0]; tot.losses -= v[1]; tot.taken -= v[2]; tot.used -= v[4]; });
      me.plan = plan; me.tot = tot; me.free = A.filter(function (a) { return !plan.some(function (p) { return p.order.indexOf(a) >= 0; }); });
      me.state = 'done'; me.ms = Date.now() - me.t0; me.nT = m;
      refresh(); redraw();
    };
    var tick = function () {
      if (seq !== me) return;
      var t0 = Date.now();
      while (ji < jobs.length && Date.now() - t0 < 40) { evalSet(jobs[ji][0], jobs[ji][1]); ji++; }
      me.pct = Math.round(100 * ji / total);
      if (ji < jobs.length) { refresh(); setTimeout(tick, 0); return; }
      finish();
    };
    refresh();
    setTimeout(tick, 0);
  }
  // load one target of the sequence into the normal calculator
  function seqLoad(tid) {
    var S = seqNow(); if (!S || !S.plan) return;
    var p = S.plan.filter(function (x) { return x.t.id === tid; })[0]; if (!p) return;
    var cb = sel(); cb.active = tid; cb.attackers = p.order.map(function (u) { return u.id; });
    S.show = false; uiPrefs().sortBy = null;
    commit();
    seq.sig = seqSig(); // the selection changed on purpose – keep the result
  }
  function seqBtnHtml() {
    var cb = sel(), nA = cb.attackers.length, nT = cb.targets.length;
    if (!nA || !nT || (nA < 2 && nT < 2)) return '';
    var S = seqNow();
    var b = '<button class="un-seqb' + (S && S.show && S.state === 'done' ? ' on' : '') + '" data-un="seq">⚔️ ' + (S && S.state === 'done' ? (S.show ? 'Hide best attack sequence' : 'Show best attack sequence') : 'Best attack sequence') +
      ' <small>(' + nA + ' attacker' + (nA > 1 ? 's' : '') + ' → ' + nT + ' target' + (nT > 1 ? 's' : '') + ')</small></button>';
    if (!S) return b;
    if (S.state === 'too') return b + '<div class="un-seq"><small>⚠ Too many: at most ' + SEQ_MAX_A + ' attackers and ' + SEQ_MAX_T + ' targets</small></div>';
    if (S.state === 'running') return b + '<div class="un-seq"><div class="bar"><i style="width:' + S.pct + '%"></i></div><small>Calculating… ' + S.pct + '%</small></div>';
    if (!S.show) return b;
    var w = words(), h = '<div class="un-seq">', T = S.tot;
    h += '<div class="sum">' + (T.kills ? '☠ <b>' + T.kills + ' of ' + S.nT + '</b> ' + (S.nT > 1 ? 'targets' : 'target') + ' defeated' : 'No target can be defeated') +
      ' · ' + (T.losses ? '<span class="die">' + T.losses + ' unit' + (T.losses > 1 ? 's' : '') + ' lost</span>' : 'no unit lost') + ' · ' + T.taken + ' damage taken</div>';
    var no = 0;
    S.plan.forEach(function (p) {
      var t = p.t, r = p.res, nm = esc(U(t.type).name);
      h += '<div class="tg"><div class="th">' + coinSvg(t.type, t.side, 22) + '<b>🎯 ' + nm + '</b> <small>' + t.hp + ' HP → ' +
        (!r ? t.hp + ' (nobody can reach it)' : r.converted ? '🌀 converted' : r.hpAfter <= 0 ? '☠' : r.hpAfter) + '</small>' +
        (p.order.length ? '<button data-un="seqload" data-id="' + t.id + '">Show in calculator</button>' : '') + '</div>';
      if (r) r.steps.forEach(function (s) {
        if (s.dmg == null) return;
        no++;
        h += '<div class="st"><span class="un-n">' + no + '</span>' + coinSvg(s.a.type, s.a.side, 18) + esc(U(s.a.type).name) + ' <small>→ −' + s.dmg +
          (s.tAfter <= 0 ? ' ☠' : ' (' + s.tAfter + ' left)') + (s.ret ? ' · ↩ ' + s.ret + (s.aAfter <= 0 ? ' <span class="die">☠ dies</span>' : ' (' + s.aAfter + ' HP)') : '') + '</small></div>';
      });
      h += '</div>';
    });
    if (S.free.length) h += '<div class="free">Not needed: ' + S.free.map(function (a) { return esc(U(a.type).name); }).join(', ') + '</div>';
    h += '</div>';
    return b + h;
  }

  // ================================================================ actions
  function placeCoin(c, r, type, side) {
    var u = { id: uid(), c: c, r: r, side: side, type: type, hp: 10, vet: false, bonus: 1, bonusMode: 'auto', src: 'user' };
    if (U(type).carry) u.carry = carryOpts(u)[0] || 'warrior';
    u.hp = maxHp(u);
    setBonus(u, 'auto');
    st().units = units().filter(function (x) { return !(x.c === c && x.r === r); });
    st().units.push(u);
    return u;
  }
  function removeUnit(id) {
    st().units = units().filter(function (x) { return x.id !== id; });
    var p = uiPrefs(); if (p.selId === id) p.selId = null;
    sel();
  }
  function moveUnit(u, c, r) {
    if (u.c === c && u.r === r) return false;
    var o = unitAt(c, r);
    if (o) { o.c = u.c; o.r = u.r; if (isAuto(o)) setBonus(o, 'auto'); } // swap
    u.c = c; u.r = r;
    if (isAuto(u)) setBonus(u, 'auto');
    return true;
  }
  function setHp(u, delta) { var h = u.hp % 1 ? (delta < 0 ? Math.floor(u.hp) : Math.ceil(u.hp)) : u.hp + delta; u.hp = clamp(h, 1, maxHp(u)); if (isDetected(u)) { u.src = 'user'; u.conf = 1; } }
  function tapUnit(u) {
    var cb = sel();
    if (isAtt(u)) {
      var i = cb.attackers.indexOf(u.id);
      if (i >= 0) cb.attackers.splice(i, 1);
      else if (!(U(u.type).atk > 0)) { toast(U(u.type).name + ' can\'t attack'); return; }
      else cb.attackers.push(u.id);
    } else {
      var j = cb.targets.indexOf(u.id);
      if (j >= 0 && cb.active === u.id) { cb.targets.splice(j, 1); cb.active = null; }
      else {
        if (j < 0) cb.targets.push(u.id);
        cb.active = u.id;
        if (PP.drawer && PP.drawer.open && PP.drawer.isOpen && !PP.drawer.isOpen() && cb.attackers.length) PP.drawer.open();
      }
    }
    commit();
  }
  function clearSel() { var cb = sel(); cb.attackers = []; cb.targets = []; cb.active = null; commit(); }
  // v13: switch the attacking side (each side keeps its own selection)
  function setAtkSide(v) {
    sel(); v = v === 'enemy' ? 'enemy' : 'me';
    if (st().combat.as === v) return;
    st().combat.as = v; closeEditor(); sel();
    commit();
    toast(v === 'enemy' ? '⚔️ Enemy attacks: tap enemy units, then your units' : '⚔️ You attack: tap your units, then enemies', 2600);
  }
  function reorder() {
    var o = bestOrder();
    if (!o) { toast('Order is already the best'); return; }
    sel().attackers = o; commit(); toast('↕ Order optimized');
  }
  function selectAllInRange() {
    var cb = sel(), t = byId(cb.active), added = 0;
    units().forEach(function (a) {
      if (!isAtt(a) || !(U(a.type).atk > 0) || cb.attackers.indexOf(a.id) >= 0) return;
      if (t && !canReach(a, t, dist(a, t))) return;
      cb.attackers.push(a.id); added++;
    });
    commit();
    toast(added ? added + ' unit' + (added > 1 ? 's' : '') + ' added' : 'No more units in range');
  }
  function applyAttack() {
    var res = calc();
    if (!res || !res.used) { toast('No attack selected'); return; }
    var dead = {}, cb = sel(), cv = cityVerdict(res), extra = 0;
    res.steps.forEach(function (s) {
      if (s.dmg == null) return;
      s.a.hp = Math.max(0, s.aAfter); if (s.a.hp <= 0) dead[s.a.id] = 1;
      if (s.poisonAtt && s.a.hp > 0) s.a.poison = true;
    });
    res.t.hp = Math.max(0, res.hpAfter); if (res.t.hp <= 0) dead[res.t.id] = 1;
    res.t.poison = res.poison; res.t.frozen = res.frozen;
    (res.fx || []).forEach(function (e) { e.u.hp = e.hp; e.u.poison = e.poison && e.hp > 0; if (e.hp <= 0) { dead[e.u.id] = 1; extra++; } });
    if (res.converted) { res.t.side = atkSide(); res.t.poison = false; }
    var kills = 0, losses = 0;
    st().units = units().filter(function (u) {
      if (!dead[u.id]) return true;
      if (isAtt(u)) losses++; else kills++;
      return false;
    });
    // the melee unit that takes the city moves onto the city tile
    if (cv && cv.yes && cv.a && dead[res.t.id] && byId(cv.a.id)) { cv.a.c = res.t.c; cv.a.r = res.t.r; if (isAuto(cv.a)) setBonus(cv.a, 'auto'); }
    cb.attackers = [];
    sel(); commit();
    var tn = U(res.t.type).name;
    toast('⚔️ Applied' + (res.converted ? ': ' + tn + ' converted' : dead[res.t.id] ? ': ' + tn + ' defeated' : ': ' + tn + ' has ' + res.hpAfter + ' HP left') +
      (extra ? ', ' + extra + ' more defeated' : '') + (losses ? ', ' + losses + ' attacker' + (losses > 1 ? 's' : '') + ' lost' : '') +
      (cv && cv.yes ? ' · 🏰 ' + U(cv.a.type).name + ' moves into the city' : ''));
  }

  // ================================================================ automatic suggestions (secondary)
  function cdist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function rgb(c) { return 'rgb(' + c.slice(0, 3).map(function (v) { return Math.round(v); }).join(',') + ')'; }
  function tribes() {
    if (PP.recog && PP.recog.tribes) { try { var r = PP.recog.tribes(); if (Array.isArray(r)) return r.filter(function (k) { return k && Array.isArray(k.color) && k.n; }); } catch (e) { /* ignore */ } }
    var cl = [];
    units().forEach(function (u) {
      if (!isDetected(u) || !Array.isArray(u.color)) return;
      var best = null, bd = 70;
      cl.forEach(function (k) { var d = cdist(k.color, u.color); if (d < bd) { bd = d; best = k; } });
      if (best) best.n++; else cl.push({ color: u.color.slice(0, 3), n: 1 });
    });
    return cl.sort(function (a, b) { return b.n - a.n; });
  }
  function setMyColor(color) {
    if (PP.recog && PP.recog.setMyColor) { PP.recog.setMyColor(color); }
    else {
      st().ui.myColor = color.map(Math.round);
      units().forEach(function (u) { if (isDetected(u) && Array.isArray(u.color)) u.side = cdist(u.color, color) < 60 ? 'me' : 'enemy'; });
    }
    uiPrefs().askColor = false;
    sel(); commit();
    toast('Color saved – units assigned');
  }
  // v16: unit detection only via AI (needs an API key) – no local badge detection any more
  var autoBusy = false;
  function hasAiKey() { try { return !!(PP.ai && PP.ai.hasKey && PP.ai.hasKey()); } catch (e) { return false; } }
  function runAi() {
    if (autoBusy || !hasAiKey() || !PP.ai.run) return;
    if (!boardImg()) { toast('Load a screenshot first'); return; }
    autoBusy = true; refresh();
    var done = function (list) { autoBusy = false; if (list && list.length) uiPrefs().askColor = true; sel(); commit(); };
    Promise.resolve(PP.ai.run()).then(done, function () { done(null); });
  }
  function dropSuggestions() {
    st().units = units().filter(function (u) { return !isDetected(u); });
    sel(); commit(); toast('Suggestions removed');
  }

  // ================================================================ drawer
  function hpCtl(u, act) {
    var mx = maxHp(u);
    return '<span class="un-hp"><button data-un="' + act + '" data-id="' + u.id + '" data-d="-1" aria-label="less HP">−</button>' +
      '<b>' + u.hp + '<small>/' + mx + '</small></b><button data-un="' + act + '" data-id="' + u.id + '" data-d="1" aria-label="more HP">+</button></span>';
  }
  var SHY = { 'Swordsman': 'Swords&shy;man', 'Defender': 'Defen&shy;der', 'Catapult': 'Cata&shy;pult' };
  function shyName(n) { return SHY[n] || esc(n); }
  function uName(u) { return esc(U(u.type).name) + (u.vet ? ' ★' : ''); }

  // v27: effects of one attack (skills) as a small line under the attacker row
  function fxHtml(s) {
    var l = [];
    if (s.zap) l.push('🪼 Tentacles hit it first: −' + s.zap);
    if (s.stomp) l.push('👣 Stomp −' + s.stomp);
    if (s.double) l.push('2 hits');
    if (s.freeze) l.push('❄️ Target frozen – no retaliation from it');
    if (s.convert) l.push('🌀 Converts the target');
    if (s.poison) l.push('🧪 Target poisoned');
    if (s.poisonAtt) l.push('🧪 Attacker gets poisoned');
    (s.fx || []).forEach(function (f) {
      l.push((f.kind === 'explode' ? '💥 ' : '💦 Splash ') + esc(U(f.u.type).name) + (f.dmg ? ' −' + f.dmg + (f.after <= 0 ? ' ☠' : ' → ' + f.after) : '') + (f.poison ? ' 🧪' : ''));
    });
    if (s.persist) l.push('↻ Persist: may attack again');
    if (s.note) l.push('ℹ️ ' + esc(s.note));
    return l.length ? '<div class="l4">' + l.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '';
  }
  // Doomux: explode instead of a normal attack
  function boomBtn(a) {
    if (!U(a.type).boomOpt) return '';
    return '<button class="un-boom' + (a.boom ? ' on' : '') + '" data-un="boom" data-id="' + a.id + '" aria-pressed="' + !!a.boom + '" title="Explode instead of attacking">💥 Explode</button>';
  }
  // poisoned / frozen toggles
  function statusChips(u) {
    return '<span class="un-stx"><button data-un="poison" data-id="' + u.id + '" class="' + (u.poison ? 'on' : '') + '" aria-pressed="' + !!u.poison + '" title="Poisoned: defense bonus halved">🧪 Poisoned</button>' +
      '<button data-un="frozen" data-id="' + u.id + '" class="' + (u.frozen ? 'on' : '') + '" aria-pressed="' + !!u.frozen + '" title="Frozen: can\'t attack or strike back">❄️ Frozen</button></span>';
  }

  function calcHtml() {
    var cb = sel(), t = byId(cb.active), h = '';
    var nA = cb.attackers.length;
    h += '<h4><span>Damage calculator</span>' + (nA || cb.targets.length ? '<button data-un="clear">Clear selection</button>' : '') + '</h4>';
    if (!nA && !t) {
      var w0 = words();
      h += '<div class="un-how"><span class="un-n">1</span> <b>' + w0.att + '</b> · <span class="un-n t">2</span> <b>' + w0.tgt + '</b></div>';
      return h;
    }
    // target tabs
    if (cb.targets.length > 1) {
      h += '<div class="un-tabs">';
      cb.targets.forEach(function (id) {
        var x = byId(id), r = calcFor(x), res = r && r.used ? (r.hpAfter <= 0 ? '<em class="k">☠</em>' : '<em>→' + r.hpAfter + '</em>') : '<em>' + x.hp + '</em>';
        h += '<button class="un-tab' + (id === cb.active ? ' on' : '') + '" data-un="tab" data-id="' + id + '">' + coinSvg(x.type, x.side, 26) + esc(U(x.type).name) + ' ' + res + '</button>';
      });
      h += '</div>';
    }
    if (!t) {
      h += '<div class="un-how"><span class="un-n">' + nA + '</span> ' + (nA > 1 ? 'attackers' : 'attacker') + ' selected – now <b>tap ' + words().tgt1 + '</b></div>';
      h += attackerList(cb);
      return h;
    }
    var res = calcFor(t), d = U(t.type);
    h += '<div class="un-card"><div class="un-th">' + coinSvg(t.type, t.side, 34) +
      '<div class="nm"><b>Target: ' + uName(t) + '</b><small>Attack ' + fmt(d.atk) + ' · Defense ' + fmt(d.def) + (d.rng > 1 ? ' · Range ' + d.rng : '') +
        (bonusDesc(t) ? ' · <span data-bonus-desc>' + esc(bonusDesc(t)) + '</span>' : '') + '</small></div>' +
      '<button class="un-x" data-un="untarget" data-id="' + t.id + '" aria-label="Remove target">✕</button></div>' +
      '<div class="un-ctl"><span style="min-width:44px">HP</span>' + hpCtl(t, 'hp') + statusChips(t) + '</div>' +
      '<div class="un-ctl" style="display:block"><span>Defense bonus</span>' + bonusHtml(t) + '</div>';
    if (!res || !res.steps.length) {
      h += '<div class="un-empty">Now tap ' + words().att + '</div></div>';
      return h;
    }
    h += '<div class="un-tbl">';
    res.steps.forEach(function (s) {
      var a = s.a;
      h += '<div class="un-row' + (s.skipped || s.none ? ' skip' : '') + '"><div class="l1"><span class="un-n">' + s.n + '</span>' + coinSvg(a.type, a.side, 22) +
        '<b>' + uName(a) + '</b>' + boomBtn(a) + '<button class="rm" data-un="unatt" data-id="' + a.id + '" aria-label="Remove attacker">✕</button></div>';
      if (!s.none && !s.skipped) {
        h += '<div class="l2"><span class="st dmg"><small>Damage</small>' + fmt(s.dmg) + '</span><span class="st ' + (s.ret ? 'ret' : 'z') + '"><small title="Retaliation">Retal.</small>' + fmt(s.ret) + '</span>' +
          '<span class="st' + (s.tAfter <= 0 ? ' kill' : '') + '"><small>Target HP</small>' + (s.tAfter <= 0 ? '☠' : s.tAfter) + '</span></div>';
      }
      var note = s.none ? '<span class="grow">' + esc(s.why || 'can\'t attack') + '</span>'
        : s.skipped ? '<span class="grow">not needed ✓</span>'
          : '<span class="grow">' + (s.aAfter <= 0 ? '<span class="die">' + (s.boom ? '💥 explodes' : '☠ dies') + '</span>' : '→ <b style="color:var(--text,#e8ecf8)">' + s.aAfter + '</b> HP') +
            (s.far ? '<br><span class="far">⚠ ' + esc(s.warn) + '</span>' : (s.d > 1 ? ' · dist. ' + s.d : '')) + '</span>';
      h += '<div class="l3">' + hpCtl(a, 'hp') + note + '</div>' + fxHtml(s) + '</div>';
    });
    h += '</div>';
    if (res.used) {
      if (res.converted) h += '<div class="un-res kill">🌀 Target is converted' + (res.hpAfter < t.hp ? ' (' + res.hpAfter + ' HP)' : '') + '</div>';
      else if (res.killedAt) h += '<div class="un-res kill">☠ Target dies on attack ' + res.killedAt + (res.killedAt < res.steps.length ? '<small>Remaining units stay free</small>' : '') + '</div>';
      else h += '<div class="un-res">Target survives with ' + res.hpAfter + ' HP' + (res.poison || res.frozen ? '<small>' + [res.poison ? '🧪 poisoned' : '', res.frozen ? '❄️ frozen' : ''].filter(Boolean).join(' · ') + '</small>' : '') + '</div>';
      var fxk = (res.fx || []).filter(function (e) { return e.hp <= 0; });
      if (res.fx && res.fx.length) h += '<div class="un-res hold" style="margin-top:4px">💦 Splash / 💥 explosion also hits: ' + res.fx.map(function (e) {
        return esc(U(e.u.type).name) + ' ' + (e.hp <= 0 ? '☠' : e.hp !== e.before ? e.before + '→' + e.hp : '') + (e.poison && e.hp > 0 ? ' 🧪' : '');
      }).join(', ') + (fxk.length ? '<small>' + fxk.length + ' more unit' + (fxk.length > 1 ? 's' : '') + ' defeated</small>' : '') + '</div>';
      if (res.losses.length) h += '<div class="un-res" style="margin-top:4px">Lost: ' + res.losses.map(function (u) { return esc(U(u.type).name); }).join(', ') + '</div>';
      h += verdictHtml(cityVerdict(res));
    }
    h += '</div>';
    h += '<div class="un-btns">' + (res.used ? '<button class="go" data-un="apply">⚔️ Apply</button>' : '') +
      '<button class="lt" data-un="all">+ All in range</button></div>';
    return h;
  }
  function attackerList(cb) {
    var h = '<div class="un-tbl">';
    cb.attackers.forEach(function (id, i) {
      var a = byId(id);
      h += '<div class="un-row"><div class="l1"><span class="un-n">' + (i + 1) + '</span>' + coinSvg(a.type, a.side, 22) + '<b>' + uName(a) + '</b>' +
        '<button class="rm" data-un="unatt" data-id="' + a.id + '" aria-label="Remove">✕</button></div><div class="l3">' + hpCtl(a, 'hp') + '</div></div>';
    });
    return h + '</div>';
  }

  var SHORT = { swordsman: 'Swords', mindbender: 'Bender', catapult: 'Catapult', defender: 'Defend.', juggernaut: 'Jugger.',
    mermaidArcher: 'Archer', mermaidDefender: 'Defend.', mermaidDagger: 'Dagger', swordsmaid: 'Swords', amphibian: 'Amphib.', tridention: 'Trident',
    dragonEgg: 'Egg', babyDragon: 'Baby', fireDragon: 'Dragon', iceArcher: 'Ice Arch.', battleSled: 'Sled', iceFortress: 'Fortress',
    insectEgg: 'Egg', livingIsland: 'Island', centipede: 'Centi', mermaid: 'Merm.', hexapod: 'Hexa', doomux: 'Doomux', shaman: 'Shaman',
    boomchi: 'Boom', segment: 'Segm.', polytaur: 'Taur' };
  // one-line unit info: HP · attack · defense · range · move + skills
  function statLine(k, u) {
    var d = U(k), hp = d.carry ? (u ? maxHp(u) - (u.vet ? 5 : 0) : null) : d.hp, sk = [];
    Object.keys(PP.SKILL_NAMES || {}).forEach(function (s) { if (d[s] && s !== 'carry') sk.push(PP.SKILL_NAMES[s]); });
    return (hp != null ? hp + ' HP · ' : 'HP of the unit it carries · ') + 'Attack ' + fmt(d.atk) + ' · Defense ' + fmt(d.def) + (d.rng !== 1 ? ' · Range ' + d.rng : '') + ' · Move ' + d.mov +
      (sk.length ? ' · ' + sk.join(', ') : '') + (d.note ? ' · ' + d.note : '');
  }
  // tribe picker for the side of new units
  function tribeHtml(p) {
    var cur = tribeOf(p.side);
    return '<div class="un-tribe" role="radiogroup" aria-label="Tribe"><span>' + (p.side === 'enemy' ? 'Enemy tribe' : 'My tribe') + '</span><div>' +
      (PP.TRIBES || []).map(function (t) {
        return '<button data-un="tribe" data-v="' + t.id + '" class="' + (t.id === cur ? 'on' : '') + '" role="radio" aria-checked="' + (t.id === cur) + '"' +
          (t.title ? ' title="' + esc(t.title) + '"' : '') + '><i style="background:' + t.dot + '"></i>' + esc(t.name) + '</button>';
      }).join('') + '</div></div>';
  }
  // ships: which unit is on board (sets the max HP)
  function carryHtml(u) {
    if (!U(u.type).carry) return '';
    var side = u.side === 'enemy' ? 'enemy' : 'me', cur = u.carry || 'warrior', opts = carryOpts(u);
    if (opts.indexOf(cur) < 0) opts = opts.concat([cur]);
    return '<div class="un-carry"><span>Carries</span><div class="types">' + opts.map(function (k) {
      return '<button data-un="carry" data-id="' + u.id + '" data-v="' + k + '" class="' + (cur === k ? 'on' : '') + '" title="' + esc(U(k).name) + ' (' + U(k).hp + ' HP)" aria-label="' + esc(U(k).name) + '">' + coinSvg(k, side, 26) + '</button>';
    }).join('') + '</div></div>';
  }
  function shortName(k) { return SHORT[k] || U(k).name; }
  // top row: Place | Battle switch (+ in Place mode: side toggle for new units and the eraser)
  function modeHtml(p) {
    var h = '<div class="un-top"><div class="un-mode" role="tablist"><button data-un="sub" data-v="place" class="' + (p.sub === 'place' ? 'on' : '') + '" role="tab">✏️ Place</button>' +
      '<button data-un="sub" data-v="battle" class="' + (p.sub === 'battle' ? 'on' : '') + '" role="tab">⚔️ Battle</button></div>';
    if (p.sub === 'place') {
      h += '<button class="un-era' + (p.eraser ? ' on' : '') + '" data-un="eraser" aria-pressed="' + !!p.eraser + '" title="Eraser: tap units to delete them" aria-label="Eraser">🧽</button>';
    }
    h += '</div>';
    if (p.sub === 'battle') {
      var as = atkSide();
      h += '<div class="un-att"><span>Attacker</span><div class="un-side" role="radiogroup" aria-label="Attacking side">' +
        '<button data-un="as" data-v="me" class="me' + (as === 'me' ? ' on' : '') + '" role="radio" aria-checked="' + (as === 'me') + '"><i style="background:#3a7bf0"></i>Me</button>' +
        '<button data-un="as" data-v="enemy" class="enemy' + (as === 'enemy' ? ' on' : '') + '" role="radio" aria-checked="' + (as === 'enemy') + '"><i style="background:#e63b55"></i>Enemy</button></div></div>';
    }
    return h;
  }
  function sideHtml(p) {
    return '<div class="un-side" title="Side of new units"><button data-un="side" data-v="me" class="me' + (p.side === 'me' ? ' on' : '') + '"><i style="background:#3a7bf0"></i>Mine</button>' +
      '<button data-un="side" data-v="enemy" class="enemy' + (p.side === 'enemy' ? ' on' : '') + '"><i style="background:#e63b55"></i>Enemy</button></div>';
  }

  // ---------------------------------------------------------------- v8 peek rows ([data-peek], one compact line)
  // nothing selected: side toggle + one row of small coins → choose the next unit fast
  function palPeekHtml(p) {
    if (p.eraser) {
      return '<div class="un-peek" data-peek="eraser"><span class="er">🧽 <b>Eraser on</b> – tap units to delete them</span>' +
        '<button class="pb ok" data-un="eraser" aria-label="Eraser off" title="Eraser off">✓</button></div>';
    }
    var other = p.side === 'enemy' ? 'me' : 'enemy';
    return '<div class="un-peek" data-peek="pal"><button class="sd1 ' + p.side + '" data-un="side" data-v="' + other + '" aria-label="New units: ' +
      (p.side === 'enemy' ? 'Enemy' : 'Mine') + ' – tap to switch" title="Side of new units (tap to switch)"><i>⇄</i>' + (p.side === 'enemy' ? 'Enemy' : 'Mine') + '</button>' +
      paletteHtml() + '</div>';
  }
  // selected unit: HP − value/max +, ★ Veteran, 🗑 Delete, ✓ done
  function selPeekHtml(u) {
    var side = u.side === 'enemy' ? 'enemy' : 'me', mx = maxHp(u);
    return '<div class="un-peek" data-peek="sel:' + u.id + '"><span class="cn" title="' + esc(U(u.type).name) + '">' + coinSvg(u.type, side, 30) + '</span>' +
      '<span class="big"><button data-un="hp" data-id="' + u.id + '" data-d="-1" aria-label="less HP">−</button><b>' + u.hp + '<small>/' + mx + '</small></b>' +
      '<button data-un="hp" data-id="' + u.id + '" data-d="1" aria-label="more HP">+</button></span><span class="gap"></span>' +
      '<button class="pb' + (u.vet ? ' on' : '') + '" data-un="vet" data-id="' + u.id + '" aria-pressed="' + !!u.vet + '" title="Veteran (+5 max HP)"' + (U(u.type).noVet && !u.vet ? ' disabled' : '') + '>★ Vet</button>' +
      '<button class="pb del" data-un="del" data-id="' + u.id + '" aria-label="Delete" title="Delete">🗑</button>' +
      '<button class="pb ok" data-un="desel" aria-label="Done" title="Done – choose the next unit">✓</button></div>';
  }
  // Battle: one-line summary of the active calculation
  function battleSum() {
    var cb = sel(), t = byId(cb.active), nA = cb.attackers.length, w = words(), en = atkSide() === 'enemy';
    if (!nA && !t) return en ? '<b>Enemy attacks:</b> tap <b>enemy units</b>, then <b>yours</b>' : 'Tap <b>your unit</b>, then an <b>enemy</b>';
    if (!t) return nA + (en ? ' enemy' : '') + ' attacker' + (nA > 1 ? 's' : '') + ' – now <b>tap ' + w.tgt1 + '</b>';
    var res = calcFor(t), tn = esc(U(t.type).name);
    if (!res || !res.used) return tn + ' <small>' + t.hp + ' HP</small> – now <b>tap ' + w.att + '</b>';
    var kill = res.hpAfter <= 0, end = res.converted ? '<span class="kill">🌀</span>' : kill ? '<span class="kill">☠</span>' : '<span class="dmg">' + res.hpAfter + '</span>';
    // v13: city verdict first (the line is clamped to two lines)
    var cv = cityVerdict(res), pre = cv ? '<span class="city ' + (cv.yes ? (cv.own ? 'dmg' : 'kill') : 'ret') + '" data-city="' + (cv.yes ? 'yes' : 'no') + '">🏰 ' +
      (cv.yes ? 'City falls' : 'City holds') + '</span> · ' : '';
    var ret = 0; res.steps.forEach(function (s) { if (s.dmg != null) ret += s.ret; });
    if (nA === 1) {
      var s = res.steps[0];
      return pre + esc(U(s.a.type).name) + ' → ' + tn + ': <span class="dmg">−' + s.dmg + '</span> · <span class="ret">↩' + s.ret + '</span> · ' + t.hp + '→' + end +
        (s.aAfter <= 0 ? ' · <span class="dmg">attacker dies</span>' : '');
    }
    return pre + nA + ' units → ' + tn + ': ' + t.hp + '→' + end + (kill && res.killedAt < res.steps.length ? ' <small>(hit ' + res.killedAt + ')</small>' : '') +
      ' · <span class="ret">↩' + ret + '</span>' + (res.losses.length ? ' · <span class="dmg">☠ ' + res.losses.length + (en ? ' enemy' : ' own') + '</span>' : '');
  }
  function battlePeekHtml() {
    var res = calc();
    var as = atkSide(), other = as === 'enemy' ? 'me' : 'enemy';
    return '<div class="un-peek" data-peek="battle"><button class="pb ok" data-un="sub" data-v="place" aria-label="Back to Place" title="✏️ Place">✏️</button>' +
      '<button class="sd1 as ' + as + '" data-un="as" data-v="' + other + '" aria-label="Attacker: ' + (as === 'enemy' ? 'Enemy' : 'Me') + ' – tap to switch" title="Who attacks? (tap to switch)"><i>⚔</i>' + (as === 'enemy' ? 'Enemy' : 'Me') + '</button>' +
      '<span class="sum">' + battleSum() + '</span>' +
      (res && res.used ? '<button class="pb go" data-un="apply">Apply</button>' : '') + '</div>';
  }
  function paletteHtml() {
    var p = uiPrefs(), h = '';
    h += '<div class="un-pal" style="margin-top:0">';
    typesFor(p.side).forEach(function (k) {
      var d = U(k);
      h += '<button data-un="brush" data-v="' + k + '" class="' + (p.brush === k ? 'on' : '') + '" title="' + esc(d.name) + ' – ' + esc(statLine(k)) + '">' +
        coinSvg(k, p.side, 30) + '<b>' + esc(shortName(k)) + '</b></button>';
    });
    h += '</div>';
    return h;
  }
  // v16: defense bonus as a wrapping chip row with descriptive kinds:
  // [Auto: Forest ×1.5 (Archery)] [None] [🌲 Forest ×1.5 Archery] [⛰️ Mountain …] [🌊 Water …] [🏠 City ×1.5] [🧱 City Wall ×4]
  function bonusHtml(u) {
    var av = autoValue(u), a = av.a, au = isAuto(u), k = kindOf(u), img = !!boardImg();
    var chip = function (v, label, cls, on, title) {
      return '<button data-un="bonus" data-id="' + u.id + '" data-v="' + v + '" class="' + cls + (on ? ' on' : '') + '" title="' + esc(title) + '" aria-pressed="' + on + '">' + label + '</button>';
    };
    var h = '<div class="un-bon4">';
    if (img) h += chip('auto', 'Auto: ' + (a.kind && a.kind !== 'none' ? KINDS[a.kind].ic + ' ' : '') + (av.noTech ? esc(KINDS[a.kind].name) + ' – no ' + esc(av.noTech) + ' ×1' : esc(kindText(a.kind || 'none'))), 'au', au, 'Detect from the screenshot');
    KIND_ORDER.forEach(function (kk) {
      var K = KINDS[kk], lbl = kk === 'none' ? 'None' : K.ic + ' ' + esc(K.name) + ' ×' + K.v + (K.tech ? ' <small>' + esc(K.tech) + '</small>' : '');
      h += chip(kk, lbl, kk === 'wall' ? 'w4' : '', !au && k === kk, kindText(kk));
    });
    h += '</div>';
    var why;
    if (!img) why = '';
    else if (a.city) why = 'Auto: <b>City ×1.5</b> (name plate seen) · has a City Wall? → pick <b>City Wall ×4</b>';
    else if (a.v > 1) why = 'Unit on ' + esc(a.why.toLowerCase()) + ' – ' + (av.noTech ? 'no bonus without ' : 'bonus with ') + esc(a.tech) +
      ' <button class="un-tech' + (av.noTech ? '' : ' on') + '" data-un="tech" data-id="' + u.id + '" data-v="' + esc(a.tech) + '">' + (av.noTech ? '' : '✓ ') + (u.side === 'me' ? 'I have ' : 'Enemy has ') + esc(a.tech) + '</button>';
    else why = 'Auto: <b>none</b>' + (a.terrain ? ' (' + esc(a.why) + ')' : '');
    if (img && !a.city && a.conf != null && a.conf < 0.6) why += ' · unsure';
    if (!au) why = 'Set: <b>' + (k ? esc(kindText(k)) : '×' + fmt(u.bonus || 1)) + '</b>' + (img ? ' · auto would be ' + esc(kindText(a.kind || 'none')) : '');
    var sc = stateCityAt(u);
    if (sc && effBonus(u) !== (u.bonus || 1)) why += (why ? ' · ' : '') + 'city list overrides: <b>' + esc(kindText(sc.walls ? 'wall' : 'city')) + '</b>';
    return h + (why ? '<div class="un-why">' + why + '</div>' : '');
  }
  // compact quick editor for one unit (panel in Place mode, popover on long-press in Battle mode)
  function quickEdHtml(u, popover) {
    var p = uiPrefs(), side = u.side === 'enemy' ? 'enemy' : 'me', mx = maxHp(u);
    var h = '<div class="un-qe"' + (popover ? ' style="margin:0;border:0;background:none;padding:0"' : '') + '>';
    h += '<div class="hd"><button class="ty" data-un="types" data-id="' + u.id + '" aria-expanded="' + !!p.typesOpen + '" title="Change type">' + coinSvg(u.type, side, 30) +
      '<span style="min-width:0;display:flex;flex-direction:column"><b>' + esc(U(u.type).name) + (u.vet ? ' ★' : '') + ' ▾</b><small>Tile ' + u.c + ', ' + u.r + (isDetected(u) ? ' · detected' : '') + '</small></span></button>' +
      '<span class="sd"><button data-un="uside" data-id="' + u.id + '" data-v="me" class="' + (side === 'me' ? 'on' : '') + '" title="Mine" aria-label="Mine"><i style="background:#3a7bf0"></i></button>' +
      '<button data-un="uside" data-id="' + u.id + '" data-v="enemy" class="' + (side === 'enemy' ? 'on' : '') + '" title="Enemy" aria-label="Enemy"><i style="background:#e63b55"></i></button></span>' +
      '<button class="del" data-un="del" data-id="' + u.id + '">🗑 Delete</button>' +
      '<button class="un-x" data-un="desel" aria-label="Done" title="Done">✓</button></div>';
    if (p.typesOpen) {
      h += '<div class="types">' + typesOfUnit(u).map(function (k) {
        return '<button data-un="utype" data-id="' + u.id + '" data-v="' + k + '" class="' + (u.type === k ? 'on' : '') + '" title="' + esc(U(k).name) + '" aria-label="' + esc(U(k).name) + '">' + coinSvg(k, side, 28) + '</button>';
      }).join('') + '</div>';
    }
    h += '<div class="ln"><span class="big"><button data-un="hp" data-id="' + u.id + '" data-d="-1" aria-label="less HP">−</button><b>' + u.hp + '<small>/' + mx + '</small></b>' +
      '<button data-un="hp" data-id="' + u.id + '" data-d="1" aria-label="more HP">+</button></span>' +
      '<button class="chip" data-un="full" data-id="' + u.id + '"' + (u.hp >= mx ? ' disabled' : '') + '>Full</button>' +
      '<button class="chip' + (u.vet ? ' on' : '') + '" data-un="vet" data-id="' + u.id + '" aria-pressed="' + !!u.vet + '"' + (U(u.type).noVet && !u.vet ? ' disabled title="Can\'t become a veteran"' : '') + '>★ Veteran</button></div>';
    h += carryHtml(u) + '<div class="un-stat">' + esc(statLine(u.type, u)) + '</div><div class="ln">' + statusChips(u) + '</div>';
    h += '<div class="ln" style="display:block">' + bonusHtml(u) + '</div>';
    return h + '</div>';
  }

  function detailHtml(u) {
    var p = uiPrefs(), side = u.side === 'enemy' ? 'enemy' : 'me', mx = maxHp(u);
    var h = '<div class="un-qe" style="margin-top:2px">';
    h += '<div class="hd"><button class="ty" data-un="types" data-id="' + u.id + '" aria-expanded="' + !!p.typesOpen + '" title="Change type">' + coinSvg(u.type, side, 30) +
      '<span style="min-width:0;display:flex;flex-direction:column"><b>' + esc(U(u.type).name) + (u.vet ? ' ★' : '') + ' ▾</b><small>Tile ' + u.c + ', ' + u.r + (isDetected(u) ? ' · detected' : '') + '</small></span></button>' +
      '<span class="sd"><button data-un="uside" data-id="' + u.id + '" data-v="me" class="' + (side === 'me' ? 'on' : '') + '" title="Mine" aria-label="Mine"><i style="background:#3a7bf0"></i></button>' +
      '<button data-un="uside" data-id="' + u.id + '" data-v="enemy" class="' + (side === 'enemy' ? 'on' : '') + '" title="Enemy" aria-label="Enemy"><i style="background:#e63b55"></i></button></span>' +
      '<button class="chip" data-un="full" data-id="' + u.id + '"' + (u.hp >= mx ? ' disabled' : '') + '>Full HP</button></div>';
    h += '<div class="un-stat">' + esc(statLine(u.type, u)) + '</div><div class="ln">' + statusChips(u) + '</div>';
    if (p.typesOpen) {
      h += '<div class="types">' + typesOfUnit(u).map(function (k) {
        return '<button data-un="utype" data-id="' + u.id + '" data-v="' + k + '" class="' + (u.type === k ? 'on' : '') + '" title="' + esc(U(k).name) + '" aria-label="' + esc(U(k).name) + '">' + coinSvg(k, side, 28) + '</button>';
      }).join('') + '</div>';
    }
    h += carryHtml(u) + '<div class="ln" style="display:block">' + bonusHtml(u) + '</div>';
    return h + '</div>';
  }

  function autoHtml() {
    var h = '<div class="un-sec">', tr = tribes(), p = uiPrefs(), nDet = units().filter(isDetected).length;
    var myC = st().ui && st().ui.myColor;
    if (tr.length && (p.askColor || !Array.isArray(myC))) {
      h += '<div class="un-q"><b>Which color are you?</b>';
      tr.slice(0, 6).forEach(function (k, i) { h += '<button data-un="color" data-i="' + i + '"><i style="background:' + rgb(k.color) + '"></i>' + k.n + '</button>'; });
      h += '</div>';
    } else if (tr.length && Array.isArray(myC)) {
      h += '<div class="un-how">Your color <i style="display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-1px;border:1px solid #fff;background:' + rgb(myC) + '"></i> <button class="un-link" data-un="askcolor">change</button></div>';
    }
    if (hasAiKey()) {
      if (boardImg()) h += '<button class="un-auto" data-un="ai"' + (autoBusy ? ' disabled' : '') + '>' + (autoBusy ? '🤖 AI is detecting units …' : '🤖 Detect units (AI)') + '</button>';
    } else if (PP.ai && PP.ai.openSettings && PP.ai.enabled && PP.ai.enabled() && boardImg()) {
      h += '<button class="un-ai" data-un="aikey">AI unit detection: add an API key in the Menu</button>';
    }
    if (nDet) h += '<div class="un-foot"><button data-un="dropauto">' + nDet + ' Remove suggestions</button></div>';
    if (units().length) h += '<div class="un-foot"><button data-un="wipe">Remove all units</button></div>';
    return h + '</div>';
  }

  function renderPanel(el) {
    if (!PP.state) return;
    injectCss();
    syncAuto();
    autoSort();
    // v8: the first element is the compact [data-peek] row (all the phone bottom sheet shows until expanded)
    var p = uiPrefs(), h = '<div class="un">';
    if (p.sub === 'place') {
      var u = p.selId ? byId(p.selId) : null;
      h += (u ? selPeekHtml(u) : palPeekHtml(p)) + '<div style="height:8px"></div>' + modeHtml(p);
      if (!u && !p.eraser) h += tribeHtml(p);
      if (u) {
        h += detailHtml(u);
        h += '<div class="un-next"><span>Next unit</span>' + sideHtml(p) + '</div>' + paletteHtml();

      }
      else if (p.eraser) h += '<div class="un-how">🧽 <b>Eraser on</b></div>';
      else h += '<div class="un-how"><b>' + esc(U(p.brush).name) + '</b> (' + (p.side === 'enemy' ? 'Enemy' : 'Mine') + ')' +
        '<small class="un-stat">' + esc(statLine(p.brush)) + '</small></div>';
      h += autoHtml();
    } else {
      h += battlePeekHtml() + '<div style="height:8px"></div>' + seqBtnHtml() + sortHtml() + modeHtml(p) + calcHtml();
      if (units().length) h += '<div class="un-foot"><button data-un="wipe">Remove all units</button></div>';
    }
    el.innerHTML = h + '</div>';
    el.onclick = onPanelClick;
  }
  // edits of one unit, shared by the quick editor (panel) and the popover; returns true if handled
  function editAction(u, a, b) {
    var v = b.getAttribute('data-v'), p = uiPrefs();
    var touched = function () { if (isDetected(u)) { u.src = 'user'; u.conf = 1; } };
    if (a === 'hp') setHp(u, +b.getAttribute('data-d'));
    else if (a === 'full') { u.hp = maxHp(u); touched(); }
    else if (a === 'vet') { var f = u.hp >= maxHp(u); u.vet = !u.vet; if (f || u.hp > maxHp(u)) u.hp = maxHp(u); touched(); }
    else if (a === 'bonus') { setBonus(u, v); touched(); }
    else if (a === 'uside') { u.side = v === 'enemy' ? 'enemy' : 'me'; touched(); sel(); }
    else if (a === 'types') { p.typesOpen = !p.typesOpen; }
    else if (a === 'utype') {
      var full = u.hp >= maxHp(u); u.type = v;
      if (U(v).carry) { if (!u.carry) u.carry = carryOpts(u)[0] || 'warrior'; } else delete u.carry;
      if (U(v).noVet && !U(v).carry) u.vet = false;
      if (full || u.hp > maxHp(u)) u.hp = maxHp(u); touched(); if (typesFor(p.side).indexOf(v) >= 0) p.brush = v;
    }
    else if (a === 'poison') { u.poison = !u.poison; touched(); }
    else if (a === 'frozen') { u.frozen = !u.frozen; touched(); }
    else if (a === 'boom') { u.boom = !u.boom; }
    else if (a === 'carry') { var full2 = u.hp >= maxHp(u); u.carry = v; if (full2 || u.hp > maxHp(u)) u.hp = maxHp(u); touched(); }
    else if (a === 'del') { removeUnit(u.id); closeEditor(); toast(U(u.type).name + ' deleted'); }
    else return false;
    commit();
    if (ed) renderEditor();
    return true;
  }
  function onPanelClick(e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-un]') : null;
    if (!b || b.disabled) return;
    var a = b.getAttribute('data-un'), id = b.getAttribute('data-id'), v = b.getAttribute('data-v'), p = uiPrefs(), cb = sel();
    var u = id ? byId(id) : null;
    if (u && editAction(u, a, b)) return;
    if (a === 'seq') {
      var S0 = seqNow();
      if (S0 && S0.state === 'done') { S0.show = !S0.show; refresh(); redraw(); }
      else if (!S0 || S0.state !== 'running') startSeq();
      return;
    }
    if (a === 'seqload') { seqLoad(id); return; }
    if (a === 'tech' && u) { toggleTech(u.side, v); syncAuto(); commit(); return; }
    if (a === 'sub') {
      if (v === 'battle' && !units().length) { toast('Place some units first'); return; }
      p.sub = v; p.selId = null; p.eraser = false; closeEditor(); commit();
    }
    else if (a === 'side') { p.side = v; uiPrefs(); commit(); }
    else if (a === 'tribe') {
      var old = typesFor(p.side), i = old.indexOf(p.brush);
      p.tribe[p.side] = v;
      // keep the "same" unit: same slot in the new tribe's list (Archer → Ice Archer …)
      var nw = typesFor(p.side); p.brush = nw[i] && i < 8 ? nw[i] : nw[0];
      commit();
    }
    else if (a === 'as') setAtkSide(v);
    else if (a === 'brush') { p.brush = v; p.eraser = false; commit(); }
    else if (a === 'eraser') { p.eraser = !p.eraser; if (p.eraser) p.selId = null; commit(); }
    else if (a === 'desel') { p.selId = null; p.typesOpen = false; closeEditor(); commit(); }
    else if (a === 'tab') { cb.active = id; commit(); }
    else if (a === 'untarget') { cb.targets = cb.targets.filter(function (x) { return x !== id; }); cb.active = null; sel(); commit(); }
    else if (a === 'unatt') { cb.attackers = cb.attackers.filter(function (x) { return x !== id; }); commit(); }
    else if (a === 'clear') clearSel();
    else if (a === 'apply') applyAttack();
    else if (a === 'best') reorder();
    else if (a === 'sort') { p.sortBy = p.sortBy === v ? null : v; autoSort(); commit(); if (p.sortBy) toast('↕ Sorted: ' + SORTS.filter(function (x) { return x[0] === v; })[0][1]); }
    else if (a === 'all') selectAllInRange();
    else if (a === 'ai') runAi();
    else if (a === 'aikey') PP.ai.openSettings();
    else if (a === 'dropauto') dropSuggestions();
    else if (a === 'askcolor') { p.askColor = true; refresh(); }
    else if (a === 'color') { var k = tribes()[+b.getAttribute('data-i')]; if (k) setMyColor(k.color); }
    else if (a === 'wipe') {
      if (PP.ui && PP.ui.confirm && !PP.ui.confirm('Remove all units?')) return;
      st().units = []; p.selId = null; clearSel(); toast('All units removed');
    }
  }

  // ================================================================ long-press editor (popover, Battle mode)
  var ed = null; // { id, el }
  function closeEditor() {
    if (!ed) return;
    if (ed.el && ed.el.parentNode) ed.el.parentNode.removeChild(ed.el);
    document.removeEventListener('pointerdown', edOutside, true);
    document.removeEventListener('keydown', edKey, true);
    ed = null;
  }
  function edOutside(e) { if (ed && ed.el && !ed.el.contains(e.target)) { closeEditor(); } }
  function edKey(e) { if (e.key === 'Escape') closeEditor(); }
  function openEditor(u) {
    closeEditor();
    var el = document.createElement('div');
    el.className = 'un-ed'; el.setAttribute('role', 'dialog');
    document.body.appendChild(el);
    ed = { id: u.id, el: el };
    el.addEventListener('click', edClick);
    setTimeout(function () {
      document.addEventListener('pointerdown', edOutside, true);
      document.addEventListener('keydown', edKey, true);
    }, 0);
    renderEditor();
  }
  function renderEditor() {
    if (!ed) return;
    var u = byId(ed.id);
    if (!u) { closeEditor(); return; }
    ed.el.innerHTML = quickEdHtml(u, true);
    placeEditor(u);
  }
  function placeEditor(u) {
    var el = ed.el, cv = document.getElementById('cv');
    var vw = window.innerWidth, vh = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight, M = 8;
    var x = (vw - w) / 2, y = (vh - h) / 2;
    if (cv && PP.board && PP.board.tileToScreen) {
      var r = cv.getBoundingClientRect(), p = cpos(u.c, u.r), R = coinR();
      var px = r.left + p.x, py = r.top + p.y;
      x = clamp(px - w / 2, M, vw - w - M);
      if (py + R + 12 + h <= vh - M) y = py + R + 12;
      else if (py - R - 12 - h >= M) y = py - R - 12 - h;
      else y = clamp(vh - h - M, M, vh);
    }
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(Math.max(M, y)) + 'px';
  }
  function edClick(e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-un]') : null;
    if (!b || !ed || b.disabled) return;
    var u = byId(ed.id); if (!u) { closeEditor(); return; }
    var a = b.getAttribute('data-un');
    if (a === 'desel') { closeEditor(); return; }
    editAction(u, a, b);
  }

  // ================================================================ map: hit testing + gestures
  function unitAtScreen(sx, sy) {
    if (!PP.board || !PP.board.tileToScreen || !isFinite(sx) || !isFinite(sy)) return null;
    var H = hitR(), best = null, bestD = Infinity;
    units().forEach(function (u) {
      var p = cpos(u.c, u.r), d = Math.hypot(sx - p.x, sy - p.y);
      if (d <= H && d < bestD) { best = u; bestD = d; }
    });
    // v12: the coin floats over the figure – a tap on the unit's own tile (feet / body) also counts
    if (!best && PP.board.screenToTile) {
      var t = PP.board.screenToTile(sx, sy);
      if (t) best = unitAt(t.c, t.r);
    }
    return best;
  }
  function resolveUnit(t) { return unitAtScreen(t.sx, t.sy) || t.unit || unitAt(t.c, t.r); }

  function onTap(t) {
    if (!t || !PP.state) return;
    closeEditor();
    var p = uiPrefs(), u = resolveUnit(t);
    if (p.sub === 'battle') {
      if (u) { tapUnit(u); return; }
      toast('Battle: tap ' + words().att + ', then ' + words().tgts + ' · ✏️ Place adds units', 2600);
      return;
    }
    // Place mode
    if (u) {
      if (p.eraser) { removeUnit(u.id); commit(); toast(U(u.type).name + ' deleted'); return; }
      p.selId = p.selId === u.id ? null : u.id; p.typesOpen = false;
      if (p.selId) showDrawer();
      commit();
      return;
    }
    if (p.eraser) { toast('Eraser on – tap a unit to delete it'); return; }
    var n = placeCoin(t.c, t.r, p.brush, p.side);
    p.selId = n.id; p.typesOpen = false;
    showDrawer();
    commit();
  }
  function onLongPress(t) {
    if (!t || !PP.state) return;
    var p = uiPrefs(), u = resolveUnit(t);
    if (p.sub === 'battle') {
      if (u) openEditor(u);
      else toast('Long-press a unit = edit');
      return;
    }
    onTap(t); // Place mode: nothing needs a long press
  }
  function showDrawer() { if (PP.drawer && PP.drawer.open && PP.drawer.isOpen && !PP.drawer.isOpen()) PP.drawer.open(); }

  // drag a coin to another tile (Place mode); target occupied → swap
  var drag = null;
  function wantsDrag(t) {
    var p = uiPrefs();
    return !!(t && p.sub === 'place' && !p.eraser && unitAtScreen(t.sx, t.sy));
  }
  function onDrag(phase, t) {
    if (phase === 'start') {
      var u = t && unitAtScreen(t.sx, t.sy);
      drag = u ? { id: u.id, c: u.c, r: u.r, sx: t.sx, sy: t.sy } : null;
    } else if (!drag) return;
    else if (phase === 'move') { drag.c = t.c; drag.r = t.r; drag.sx = t.sx; drag.sy = t.sy; }
    else if (phase === 'end') {
      var m = byId(drag.id), p = uiPrefs();
      drag = null;
      if (m && t && moveUnit(m, t.c, t.r)) { p.selId = m.id; commit(); }
      else redraw();
    } else { drag = null; redraw(); }
  }

  // ================================================================ map drawing
  function pulse() { return 0.5 + 0.5 * Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 260); }
  var layerSeen = false;
  function visibleP(p, m) {
    var s = PP.board.size ? PP.board.size() : { w: 1e5, h: 1e5 };
    return p.x > -m && p.y > -m && p.x < s.w + m && p.y < s.h + m;
  }

  function drawMap(ctx, D, active) {
    if (!PP.state || !PP.board || !PP.board.tileToScreen) return;
    syncAuto();
    var R = coinR(), cb = sel(), pr = uiPrefs(), battle = pr.sub === 'battle', res = active && battle ? calc() : null, k = pulse();
    var showSel = active && battle && (cb.attackers.length || cb.targets.length);
    var selId = active && !battle ? pr.selId : null, dragId = active && drag ? drag.id : null;
    // drag target tile outline
    if (dragId) {
      var pts = PP.grid.corners(drag.c, drag.r).map(function (q) { return PP.board.toScreen(q.x, q.y); });
      ctx.save(); ctx.beginPath(); pts.forEach(function (q, i) { ctx[i ? 'lineTo' : 'moveTo'](q.x, q.y); }); ctx.closePath();
      ctx.fillStyle = 'rgba(76,201,240,.18)'; ctx.fill();
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#4cc9f0'; ctx.stroke(); ctx.restore();
    }
    var attIdx = {}, tgt = {};
    if (showSel) { cb.attackers.forEach(function (id, i) { attIdx[id] = i; }); cb.targets.forEach(function (id) { tgt[id] = 1; }); }
    // 1) glows under the coins
    if (showSel) {
      cb.attackers.forEach(function (id) {
        var u = byId(id); if (!u) return;
        var p = cpos(u.c, u.r), outer = R * (1.5 + 0.15 * k);
        var g = ctx.createRadialGradient(p.x, p.y, R * DR, p.x, p.y, outer);
        g.addColorStop(0, 'rgba(255,226,90,.6)'); g.addColorStop(0.45, 'rgba(255,200,40,.22)'); g.addColorStop(1, 'rgba(255,200,40,0)');
        ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, outer, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    }
    // 2) coins (back to front by screen y)
    var list = units().slice().sort(function (a, b) {
      return cpos(a.c, a.r).y - cpos(b.c, b.r).y;
    });
    var tAct = res ? res.t : null, stepOf = {};
    if (res) res.steps.forEach(function (s) { stepOf[s.a.id] = s; });
    list.forEach(function (u) {
      var p = cpos(u.c, u.r);
      if (!visibleP(p, R * 3)) return;
      var dim = showSel && res && res.used && attIdx[u.id] == null && !tgt[u.id];
      // selection rings below the coin face
      if (showSel && attIdx[u.id] != null) {
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, R * DR + Math.max(2.2, R * 0.13), 0, Math.PI * 2);
        ctx.lineWidth = clamp(R * 0.08, 1.4, 2.6) + 1.4; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.stroke();
        ctx.lineWidth = clamp(R * 0.08, 1.4, 2.6); ctx.strokeStyle = '#ffd23f';
        ctx.shadowColor = 'rgba(255,210,63,.9)'; ctx.shadowBlur = 4 + 5 * k; ctx.stroke(); ctx.restore();
      }
      if (showSel && tgt[u.id]) {
        var on = u.id === cb.active, rr = R * DR + Math.max(3, R * 0.18), tw = on ? clamp(R * 0.085, 1.5, 2.8) : 1.2;
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.lineWidth = tw + 1.6; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.stroke();
        ctx.setLineDash([Math.max(3.5, R * 0.3), Math.max(2.5, R * 0.18)]); ctx.lineDashOffset = -k * 10; ctx.lineCap = 'round';
        ctx.lineWidth = tw; ctx.strokeStyle = on ? '#ff4d6d' : 'rgba(255,140,166,.85)';
        if (on) { ctx.shadowColor = 'rgba(255,77,109,.8)'; ctx.shadowBlur = 3 + 3 * k; }
        ctx.stroke();
        ctx.restore();
      }
      if (u.id === dragId) { drawCoin(ctx, u, p.x, p.y, R, { alpha: 0.3 }); return; }
      if (u.id === selId) {
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, R * DR + Math.max(2.4, R * 0.14), 0, Math.PI * 2);
        ctx.lineWidth = clamp(R * 0.08, 1.5, 2.6) + 1.6; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
        ctx.lineWidth = clamp(R * 0.08, 1.5, 2.6); ctx.strokeStyle = '#4cc9f0';
        ctx.shadowColor = 'rgba(76,201,240,.8)'; ctx.shadowBlur = 4; ctx.stroke(); ctx.restore();
      }
      drawCoin(ctx, u, p.x, p.y, R, { alpha: dim ? 0.55 : null, foot: PP.board.tileToScreen(u.c, u.r) });
    });
    if (dragId) { var du = byId(dragId); if (du) drawCoin(ctx, du, drag.sx, drag.sy - Math.max(R * 1.3, 24), Math.max(R * 1.3, 10)); }
    if (!showSel) return;
    // v32: the best attack sequence is open → its arrows and numbers instead of the calculator's
    var SQ = seqNow();
    if (SQ && SQ.state === 'done' && SQ.show) {
      var no = 0, nr0 = clamp(R * 0.45, 6, 9.5);
      SQ.plan.forEach(function (pl) {
        if (!pl.res) return;
        var tq = cpos(pl.t.c, pl.t.r);
        pl.res.steps.forEach(function (st2) {
          if (st2.dmg == null) return;
          no++;
          var ap = cpos(st2.a.c, st2.a.r);
          thinArrow(ctx, ap, tq, st2.aAfter <= 0 ? '#ff6b81' : '#4cc9f0', R, no, false);
          numBadge(ctx, ap.x - R * 0.8 - nr0 * 0.35, ap.y - R * 0.8 - nr0 * 0.35, String(no), nr0, '#4cc9f0', '#08121f');
        });
        var fs3 = clamp(R * 0.55, 10, 16), kill3 = pl.res.hpAfter <= 0 || pl.res.converted;
        chip(ctx, tq.x, tq.y - R - fs3 * 1.05, kill3 ? '☠ ' + pl.t.hp + '→0' : pl.t.hp + '→' + pl.res.hpAfter, fs3, kill3 ? '#06a77d' : '#b3122f', '#fff', '#fff');
        drawFx(ctx, pl.res, R);
      });
      return;
    }
    // 3) arrows attacker → active target
    if (tAct) {
      var tp = cpos(tAct.c, tAct.r);
      cb.attackers.forEach(function (id, i) {
        var a = byId(id); if (!a) return;
        var s = stepOf[id], col = !s || s.skipped || s.none ? 'rgba(190,190,200,.85)' : s.far ? '#ffaa00' : '#ffd23f';
        thinArrow(ctx, cpos(a.c, a.r), tp, col, R, i + 1, s && s.far);
      });
    }
    // 4) order numbers + predicted HP
    cb.attackers.forEach(function (id, i) {
      var u = byId(id); if (!u) return;
      var p = cpos(u.c, u.r), s = stepOf[id];
      var nr = clamp(R * 0.45, 6, 9.5);
      numBadge(ctx, p.x - R * 0.8 - nr * 0.35, p.y - R * 0.8 - nr * 0.35, String(i + 1), nr, '#ffd23f', '#1d1a10');
      if (s && s.dmg != null && s.ret) chip(ctx, p.x, p.y + R + clamp(R * 0.48, 9, 14) * 1.1, s.aAfter <= 0 ? '☠ ' + s.aBefore + '→0' : s.aBefore + '→' + s.aAfter, clamp(R * 0.48, 9, 14), s.aAfter <= 0 ? '#b3122f' : 'rgba(14,18,34,.92)', '#fff', 'rgba(255,210,63,.9)');
    });
    if (res) drawFx(ctx, res, R);
    if (tAct && res && res.used) {
      var q = cpos(tAct.c, tAct.r), kill = res.hpAfter <= 0;
      chip(ctx, q.x, q.y - R - clamp(R * 0.55, 10, 16) * 1.05, kill ? '☠ ' + tAct.hp + '→0' : tAct.hp + '→' + res.hpAfter, clamp(R * 0.55, 10, 16), kill ? '#06a77d' : '#b3122f', '#fff', '#fff');
    }
  }

  // v43: splash / explosion damage on the units around the target – orange dashed ring + 💦 / 💥 chip with the HP change
  function drawFx(ctx, res, R) {
    if (!res || !res.fx || !res.fx.length) return;
    var kind = {};
    (res.steps || []).forEach(function (s) { (s.fx || []).forEach(function (f) { if (f.kind === 'explode') kind[f.u.id] = 'explode'; else if (!kind[f.u.id]) kind[f.u.id] = 'splash'; }); });
    res.fx.forEach(function (e) {
      if (e.hp === e.before && !e.poison) return;
      var q2 = cpos(e.u.c, e.u.r), fs2 = clamp(R * 0.48, 9, 14), dead = e.hp <= 0;
      ctx.save(); ctx.beginPath(); ctx.arc(q2.x, q2.y, R * DR + Math.max(3, R * 0.2), 0, Math.PI * 2);
      ctx.setLineDash([Math.max(3, R * 0.25), Math.max(2, R * 0.15)]); ctx.lineWidth = clamp(R * 0.09, 1.6, 3); ctx.strokeStyle = '#ff9f1c'; ctx.stroke(); ctx.restore();
      var ic = kind[e.u.id] === 'explode' ? '💥 ' : '💦 ', fmtH = function (v) { return String(+(+v).toFixed(1)); };
      var txt = ic + (e.hp === e.before ? '🧪 poisoned' : dead ? '☠ ' + fmtH(e.before) + '→0' : fmtH(e.before) + '→' + fmtH(e.hp) + (e.poison ? ' 🧪' : ''));
      chip(ctx, q2.x, q2.y - R - fs2 * 1.05, txt, fs2, dead ? '#06a77d' : '#b85c00', '#fff', 'rgba(255,255,255,.85)');
    });
  }
  // slim arrow with dark outline, slim head and a number badge
  function thinArrow(ctx, p, q, col, R, n, dashed) {
    var dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
    var pad0 = R + 3, pad1 = R + Math.max(5, R * 0.3);
    if (L < pad0 + pad1 + 6) return;
    dx /= L; dy /= L;
    var w = clamp(R * 0.13, 1.6, 4), hl = clamp(R * 0.6, 7, 18), hw = hl * 0.42;
    var sx = p.x + dx * pad0, sy = p.y + dy * pad0, ex = q.x - dx * pad1, ey = q.y - dy * pad1;
    var bx = ex - dx * hl * 0.85, by = ey - dy * hl * 0.85, nx = -dy, ny = dx;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var line = function () { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx, by); };
    var head = function () {
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - dx * hl + nx * hw, ey - dy * hl + ny * hw);
      ctx.quadraticCurveTo(ex - dx * hl * 0.7, ey - dy * hl * 0.7, ex - dx * hl - nx * hw, ey - dy * hl - ny * hw);
      ctx.closePath();
    };
    if (dashed) ctx.setLineDash([w * 3, w * 2.2]);
    line(); ctx.lineWidth = w + 2.4; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
    ctx.setLineDash([]);
    head(); ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
    if (dashed) ctx.setLineDash([w * 3, w * 2.2]);
    line(); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
    ctx.setLineDash([]);
    head(); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
    // number on the shaft (middle of the visible part)
    var t = 0.5, mx = sx + (bx - sx) * t, my = sy + (by - sy) * t;
    if (Math.hypot(bx - sx, by - sy) > R * 1.6) numBadge(ctx, mx, my, String(n), clamp(R * 0.36, 7, 11), col, '#1d1a10');
  }
  function numBadge(ctx, x, y, txt, r, bg, fg) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = Math.max(0.9, r * 0.13); ctx.strokeStyle = 'rgba(20,16,0,.8)'; ctx.stroke();
    ctx.fillStyle = fg; ctx.font = '700 ' + Math.round(r * 1.25) + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y + r * 0.06);
    ctx.restore();
  }

  // pulse animation (~16 fps) only while something is selected in this tool
  var animTimer = 0;
  function tick() {
    var cb = PP.state && PP.state.combat ? sel() : null;
    var need = isActive() && cb && ((cb.attackers || []).length || (cb.targets || []).length);
    if (need && !animTimer) animTimer = setInterval(function () {
      if (!isActive() || (typeof document !== 'undefined' && document.hidden)) return stopAnim();
      redraw();
    }, 60);
    else if (!need) stopAnim();
  }
  function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = 0; } }

  // ================================================================ mode
  function takeOverUnits() { if (PP.board && 'drawUnits' in PP.board) PP.board.drawUnits = false; }
  takeOverUnits();

  var mode = {
    sheetSwitch: {
      items: [{ id: 'place', label: '✏️ Place' }, { id: 'battle', label: '⚔️ Battle' }],
      value: function () { return uiPrefs().sub; },
      set: function (v) {
        var p = uiPrefs();
        if (v === p.sub) return;
        if (v === 'battle' && !units().length) { toast('Place some units first'); return; }
        p.sub = v; p.selId = null; p.eraser = false; closeEditor(); commit();
      }
    },
    label: 'Units',
    icon: '🪖',
    hint: function () {
      if (!PP.state) return '';
      var cb = sel(), p = uiPrefs();
      if (p.sub === 'place') {
        if (p.eraser) return '🧽 Tap units to delete them';
        if (p.selId) return '';
        return units().length ? 'Tap a tile = place ' + U(p.brush).name + ' · tap a unit = edit' : 'Tap a tile to place a ' + U(p.brush).name;
      }
      var w = words();
      if (cb.attackers.length && !cb.targets.length) return 'Now tap ' + w.tgt1;
      if (cb.attackers.length || cb.targets.length) return '';
      return atkSide() === 'enemy' ? 'Enemy attacks: tap enemy units, then yours' : 'Tap your units, then an enemy';
    },
    onEnter: function () { injectCss(); takeOverUnits(); if (PP.state) { sel(); uiPrefs(); syncAuto(); } },
    onExit: function () { closeEditor(); stopAnim(); drag = null; },
    onTap: onTap,
    onLongPress: onLongPress,
    wantsDrag: wantsDrag,
    onDrag: onDrag,
    renderPanel: renderPanel,
    // old core: hide its own unit markers (v6 core: PP.board.drawUnits = false)
    decorate: function (obj, kind) { return kind === 'unit' ? { hidden: true } : null; },
    // v6 core: persistent layer for all tools
    drawAlways: function (ctx, D, active) { layerSeen = true; drawMap(ctx, D, active); if (active) tick(); },
    // fallback for a core without drawAlways
    drawOver: function (ctx, D) { if (!layerSeen) { drawMap(ctx, D, true); tick(); } }
  };

  PP.units = {
    mode: mode, calc: calc, calcFor: calcFor, simulate: simulate, bestOrder: bestOrder,
    coinSvg: coinSvg, drawCoin: drawCoin, coinRadius: coinR, unitAtScreen: unitAtScreen,
    drawMap: drawMap, openEditor: function (id) { var u = byId(id); if (u) openEditor(u); }, closeEditor: closeEditor,
    place: function (c, r, type, side) { var u = placeCoin(c, r, type, side || 'me'); commit(); return u; },
    autoBonus: function (c, r) { return autoFor(c, r); }, detectedCities: function () { autoSig(); return detectedCities(); },
    ringSamples: ringSamples, syncAuto: syncAuto, RING: RING,
    setSub: function (v) { var p = uiPrefs(); p.sub = v; p.selId = null; commit(); },
    setAttacker: setAtkSide, attacker: function () { return PP.state ? atkSide() : 'me'; }, cityVerdict: cityVerdict, cityAt: cityAt,
    GLYPHS: GLYPHS
  };

  if (PP.modes && PP.modes.register) PP.modes.register('units', mode);
  else { PP._pendingModes = PP._pendingModes || []; PP._pendingModes.push(['units', mode]); }
})(window.PP);
