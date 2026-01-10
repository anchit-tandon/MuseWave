(async function(){
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  function resize(){
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  }
  addEventListener('resize', resize);
  resize();

  // load metadata
  let metadata = {sections:[]};
  try{
    const resp = await fetch('../metadata.json');
    metadata = await resp.json();
  }catch(e){console.warn('metadata.json not found',e)}

  // pick colors per section (cycled palette)
  const palette = [
    ['#0fffc9','#004d40'],
    ['#ff5c93','#2b002b'],
    ['#ffd166','#2b2200'],
    ['#9bf6ff','#001f3f']
  ];
  function sectionColor(idx){
    return palette[idx % palette.length];
  }

  // Audio setup
  const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  const audio = new Audio();
  audio.src = AUDIO_SRC;
  audio.crossOrigin = 'anonymous';
  const track = audioCtx.createMediaElementSource(audio);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  track.connect(analyser);
  analyser.connect(audioCtx.destination);

  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const playBtn = document.getElementById('play');
  const timeEl = document.getElementById('time');
  playBtn.addEventListener('click', async ()=>{
    if(audioCtx.state === 'suspended') await audioCtx.resume();
    if(audio.paused){ audio.play(); playBtn.textContent='Pause' } else { audio.pause(); playBtn.textContent='Play / Pause' }
  });

  function formatTime(s){
    const m = Math.floor(s/60);
    const ss = Math.floor(s%60).toString().padStart(2,'0');
    return `${m}:${ss}`;
  }

  function currentSection(t){
    for(let i=0;i<metadata.sections.length;i++){
      const s = metadata.sections[i];
      if(t >= s.start && t < s.start + s.dur) return i;
    }
    return metadata.sections.length-1;
  }

  // animate
  let lastSecIndex = -1;
  let hueOffset = 0;
  function draw(){
    analyser.getByteFrequencyData(freqData);
    const now = audio.currentTime || 0;
    timeEl.textContent = `${formatTime(now)} / ${formatTime(audio.duration || metadata.duration || 0)}`;

    // determine section and color
    const secIdx = currentSection(now);
    if(secIdx !== lastSecIndex){
      // trigger a color transition
      lastSecIndex = secIdx;
      hueOffset = (Math.random()*360)|0;
    }
    const cols = sectionColor(secIdx >=0 ? secIdx : 0);

    // background gradient
    const g = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
    g.addColorStop(0, cols[1]);
    g.addColorStop(1, cols[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // draw frequency bars
    const w = canvas.width / 2; // canvas scaled
    const h = canvas.height / 2;
    const barCount = 80;
    const step = Math.floor(freqData.length / barCount);
    for(let i=0;i<barCount;i++){
      const idx = i*step;
      const v = freqData[idx] / 255;
      const bw = (canvas.width / barCount) * 0.7 / devicePixelRatio;
      const x = i * (canvas.width / barCount) / devicePixelRatio + 4;
      const barH = v * (canvas.height / 3) / devicePixelRatio;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + v*0.75})`;
      // vertical bars from bottom
      ctx.fillRect(x, (canvas.height / devicePixelRatio) - barH - 20, bw, barH);
    }

    // central pulsing orb reacting to low frequencies
    // average low band
    let lowSum = 0; let lowCount = 0;
    for(let i=0;i<Math.floor(freqData.length*0.12);i++){ lowSum += freqData[i]; lowCount++; }
    const lowAvg = (lowSum/Math.max(1,lowCount))/255;
    const orbR = 60 + lowAvg * 160;
    const cx = canvas.width / (2*devicePixelRatio);
    const cy = canvas.height / (2*devicePixelRatio);
    const grd = ctx.createRadialGradient(cx,cy,10,cx,cy,orbR*2);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.3, cols[0]);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.fillStyle = grd; ctx.arc(cx,cy,orbR,0,Math.PI*2); ctx.fill();

    requestAnimationFrame(draw);
  }

  // ensure audio loads metadata
  audio.addEventListener('loadedmetadata', ()=>{
    timeEl.textContent = `0:00 / ${formatTime(audio.duration)}`;
  });

  draw();
})();
