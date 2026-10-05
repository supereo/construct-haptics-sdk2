"use strict";
(() => {
  const core = globalThis.SupereoHapticsCore;
  const patterns = globalThis.SupereoDemoPatterns;
  const $ = id => document.getElementById(id);
  const names = ["Selection tick", "Light impact", "Medium impact", "Strong impact", "Soft impact", "Crisp impact", "Success", "Warning", "Error"];
  const glyphs = ["·", "▂", "▄", "▆", "∿", "▏", "··•", "••", "•··•"];
  let native = globalThis.cordova?.plugins?.SupereoHaptics || null;
  let enabled = true, strength = 1, activeUntil = 0, generation = 0, frame = 0;
  let displayed = core.validatePattern(patterns["soft-pulse"]), position = 0, lastKey = "", lastTime = -Infinity;
  const simulation = { backend: "preview-simulation", bridgeAvailable: false, hardwareAvailable: false, intensityControl: false, advancedPatterns: false, sharpnessControl: false };
  function renderCaps(caps) {
    const rows = [["Native bridge", caps.bridgeAvailable], ["Hardware confirmed", caps.hardwareAvailable], ["Intensity control", caps.intensityControl], ["Advanced native patterns", caps.advancedPatterns], ["Sharpness control", caps.sharpnessControl]];
    $("capabilities").replaceChildren(...rows.map(([name, value]) => { const row = document.createElement("div"); row.className = "cap-row"; const label = document.createElement("span"); label.textContent = name; const result = document.createElement("span"); result.className = "cap-value"; result.textContent = value ? "Supported" : native ? "Not confirmed" : "Not exercised"; row.append(label, result); return row; }));
    $("backend").textContent = native ? caps.backend : "Preview simulation";
    $("backend-note").textContent = native ? "Native API dispatch can be tested here; physical output is not observable." : "Visual feedback only. Your device's haptics are not being tested.";
  }
  renderCaps(simulation);
  function output(value) { $("result").textContent = JSON.stringify(value, null, 2); }
  function semanticIllustration(key) {
    const times = key === "success" ? [0, 95, 210] : key === "warning" ? [0, 115] : key === "error" ? [0, 80, 160, 290] : [0];
    const weight = { "selection-tick": 0.2, "light-impact": 0.35, "medium-impact": 0.6, "strong-impact": 1, "soft-impact": 0.45, "crisp-impact": 0.75 }[key] || 0.65;
    return core.validatePattern({ version: 1, events: times.map((timeMs, i) => ({ timeMs, type: "transient", intensity: key === "success" ? 0.25 + i * 0.3 : weight, sharpness: 0.5 })) });
  }
  function valueAt(event, parameter, t) {
    const points = event.curves?.[parameter]; let value = event[parameter];
    if (!points) return value;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]; if (t < p.timeMs) { const previous = i ? points[i-1] : { timeMs: 0, value }; return previous.value + (p.value - previous.value) * ((t - previous.timeMs) / (p.timeMs - previous.timeMs || 1)); }
      value = p.value;
    }
    return value;
  }
  function draw() {
    const canvas = $("timeline"); const rect = canvas.getBoundingClientRect(); const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * scale); canvas.height = Math.round(rect.height * scale);
    const ctx = canvas.getContext("2d"); ctx.scale(scale, scale); const w = rect.width, h = rect.height, total = Math.max(700, core.durationMs(displayed) + 100);
    $("timeline-end").textContent = total + " ms";
    ctx.strokeStyle = "#eae6f1"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = 8 + (h - 16) * i / 4; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke(); }
    for (const event of displayed.events) {
      const x = event.timeMs / total * w;
      if (event.type === "transient") { const height = event.intensity * strength * (h - 16); ctx.fillStyle = "#9076e5"; ctx.beginPath();ctx.roundRect(Math.max(0,x-3),h-8-height,6,Math.max(2,height),3);ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x,h-8); for (let t = 0; t <= event.durationMs; t += 5) ctx.lineTo((event.timeMs+t)/total*w,h-8-valueAt(event,"intensity",t)*strength*(h-16));ctx.lineTo((event.timeMs+event.durationMs)/total*w,h-8);ctx.closePath();ctx.fillStyle="#d9cef6";ctx.fill();ctx.strokeStyle="#9076e5";ctx.stroke(); }
    }
    if(position>0){const x=Math.min(w,position/total*w);ctx.strokeStyle="#4d367e";ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  }
  function animate(duration) {
    cancelAnimationFrame(frame); const started = performance.now(); const token = generation; position = 0;
    $("pulse-dot").classList.add("playing");
    const step = now => { if (token !== generation) return; position = Math.min(duration, now-started); draw(); if (position < duration) frame = requestAnimationFrame(step); else $("pulse-dot").classList.remove("playing"); };
    frame = requestAnimationFrame(step);
  }
  async function stop(reason = "stopped") {
    generation++; activeUntil = 0; cancelAnimationFrame(frame); position=0;draw();$("pulse-dot").classList.remove("playing");$("now-playing").textContent="Pattern " + reason + ".";
    try { output(native ? await native.stop() : { accepted: true, backend:"preview-simulation",reason,physicalOutput:false }); } catch(error){output({code:error.code,message:error.message});}
  }
  async function play(key, request, illustration) {
    const now = performance.now();
    if (!enabled || strength===0) { output({accepted:false,reason:"disabled-or-zero-strength",backend:native?"native":"preview-simulation"});return; }
    if(key===lastKey&&now-lastTime<35){output({accepted:false,reason:"duplicate"});return;}
    lastKey=key;lastTime=now;
    if(now<activeUntil&&$("overlap").value==="ignore"){output({accepted:false,reason:"busy"});return;}
    const token=++generation; const duration=core.durationMs(illustration); activeUntil=now+duration;
    const payload={...request,requestId:"demo-"+token,strength:1,overlap:$("overlap").value};
    try {
      const result=native?await native.play(payload):{accepted:true,requestId:payload.requestId,backend:"preview-simulation",approximated:true,fallback:["visual-simulation-no-native-hardware"],durationMs:duration,completion:"not-observable"};
      if(token!==generation)return;output(result);if(!result.accepted){activeUntil=0;return;}
      displayed=illustration;$("duration").textContent=duration+" ms";$("now-playing").textContent=key.replaceAll("-"," ");animate(duration);
    }catch(error){if(token===generation){activeUntil=0;output({code:error.code||"ERROR",message:error.message});}}
  }
  Object.keys(core.presets).forEach((key,index)=>{const button=document.createElement("button");button.className="preset";button.innerHTML='<span class="glyph">'+glyphs[index]+'</span><b>'+names[index]+'</b><small>'+(["A small acknowledgement","A delicate tap","A balanced hit","A confident hit","A rounded pulse","A precise edge","A little celebration","Pay attention","Try again"][index])+'</small>';button.addEventListener("click",()=>{document.querySelectorAll(".preset").forEach(b=>b.classList.remove("active"));button.classList.add("active");play(key,core.getPreset(key),semanticIllustration(key));});$("presets").append(button);});
  Object.entries(patterns).forEach(([name,pattern])=>{const button=document.createElement("button");button.textContent=name.replaceAll("-"," ");button.addEventListener("click",()=>{document.querySelectorAll(".pattern-buttons button").forEach(b=>b.classList.remove("active"));button.classList.add("active");const normalized=core.validatePattern(pattern);$("json").value=JSON.stringify(pattern,null,2);play(name,{kind:"pattern",pattern:normalized},normalized);});$("patterns").append(button);});
  $("json").value=JSON.stringify(patterns["soft-pulse"],null,2);
  $("play-json").addEventListener("click",()=>{try{const pattern=core.validatePattern($("json").value);play("custom-pattern",{kind:"pattern",pattern},pattern);}catch(error){output({code:error.code,message:error.message});}});
  $("stop").addEventListener("click",()=>stop());
  $("enabled").addEventListener("change",async()=>{enabled=$("enabled").checked;if(!enabled)await stop("disabled");try{if(native)await native.setState({enabled,strength});}catch(error){output({code:error.code,message:error.message});}});
  $("strength").addEventListener("input",async()=>{strength=Number($("strength").value);$("strength-value").textContent=Math.round(strength*100)+"%";draw();try{if(native)await native.setState({enabled,strength});if(strength===0)await stop("silent");}catch(error){output({code:error.code,message:error.message});}});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)stop("on background");});
  window.addEventListener("resize",draw);draw();
  document.addEventListener("deviceready",async()=>{native=globalThis.cordova?.plugins?.SupereoHaptics||null;if(native)try{renderCaps(await native.getCapabilities());await native.setState({enabled,strength});}catch(error){output({code:error.code,message:error.message});}},{once:true});
})();
