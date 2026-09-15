(() => {
  if (window.__realPlayWorldPlayerBarVectorInstalled) return;
  window.__realPlayWorldPlayerBarVectorInstalled = true;

  const FILTER_ATTRIBUTE = 'data-rp-player-bar-filter';

  function dataUrl(svg) {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function premiumBar({
    outerA,
    outerB,
    outerC,
    innerA,
    innerB,
    innerC,
    edge,
    edgeSoft,
    rail,
    railSoft,
    glow,
    socket,
    socketDeep,
    ovr,
  }) {
    return dataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 140" preserveAspectRatio="none">
        <defs>
          <linearGradient id="outer" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${outerA}"/>
            <stop offset=".075" stop-color="${outerC}"/>
            <stop offset=".145" stop-color="${edge}"/>
            <stop offset=".215" stop-color="${outerB}"/>
            <stop offset=".39" stop-color="${outerC}"/>
            <stop offset=".53" stop-color="${edgeSoft}"/>
            <stop offset=".69" stop-color="${outerC}"/>
            <stop offset=".84" stop-color="${outerB}"/>
            <stop offset=".93" stop-color="${edge}"/>
            <stop offset="1" stop-color="${outerA}"/>
          </linearGradient>
          <linearGradient id="inner" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${innerA}"/>
            <stop offset=".17" stop-color="${innerB}"/>
            <stop offset=".47" stop-color="${innerC}"/>
            <stop offset=".78" stop-color="${innerB}"/>
            <stop offset="1" stop-color="${innerA}"/>
          </linearGradient>
          <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${railSoft}" stop-opacity="0"/>
            <stop offset=".11" stop-color="${railSoft}" stop-opacity=".48"/>
            <stop offset=".22" stop-color="${rail}" stop-opacity=".96"/>
            <stop offset=".50" stop-color="${edge}" stop-opacity=".78"/>
            <stop offset=".78" stop-color="${rail}" stop-opacity=".96"/>
            <stop offset=".92" stop-color="${railSoft}" stop-opacity=".48"/>
            <stop offset="1" stop-color="${railSoft}" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${edge}" stop-opacity=".86"/>
            <stop offset=".22" stop-color="${outerB}" stop-opacity=".54"/>
            <stop offset=".50" stop-color="${innerA}" stop-opacity=".12"/>
            <stop offset=".76" stop-color="${outerA}" stop-opacity=".64"/>
            <stop offset="1" stop-color="${edgeSoft}" stop-opacity=".55"/>
          </linearGradient>
          <linearGradient id="socket" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${socket}"/>
            <stop offset=".48" stop-color="${socketDeep}"/>
            <stop offset="1" stop-color="${socket}"/>
          </linearGradient>
          <linearGradient id="ovr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${ovr}"/>
            <stop offset=".55" stop-color="${innerA}"/>
            <stop offset="1" stop-color="${outerC}"/>
          </linearGradient>
          <radialGradient id="badgeGlow" cx="68%" cy="50%" r="40%">
            <stop offset="0" stop-color="${glow}" stop-opacity=".30"/>
            <stop offset=".42" stop-color="${glow}" stop-opacity=".12"/>
            <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
          </radialGradient>
          <filter id="softGlow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="2.2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <path d="M12 70L31 36L48 20L117 12L153 19L182 18H819L851 20L929 14L974 30L990 48L976 70L990 92L974 110L929 126L851 120L819 122H182L153 121L117 128L48 120L31 104Z" fill="url(#outer)"/>
        <path d="M17 70L35 39L52 24L118 17L153 24L181 23H821L852 25L927 20L968 34L983 49L970 70L983 91L968 106L927 120L852 115L821 117H181L153 116L118 123L52 116L35 101Z" fill="${innerA}" stroke="${edge}" stroke-opacity=".82" stroke-width="2.1"/>
        <path d="M26 70L43 42L58 30L123 23L155 30H824L855 31L924 27L959 39L972 51L961 70L972 89L959 101L924 113L855 109L824 110H155L123 117L58 110L43 98Z" fill="url(#bevel)" opacity=".68"/>
        <path d="M34 70L50 46L64 36L127 29L159 36H822L852 37L920 33L950 43L961 53L952 70L961 87L950 97L920 107L852 103L822 104H159L127 111L64 104L50 94Z" fill="url(#inner)"/>

        <path d="M24 70L41 39L55 27L116 20L148 29L132 70L148 111L116 120L55 113L41 101Z" fill="url(#socket)" stroke="${edge}" stroke-opacity=".95" stroke-width="2.25"/>
        <path d="M38 70L52 46L63 38L109 33L130 39L120 70L130 101L109 107L63 102L52 94Z" fill="${socketDeep}" stroke="${rail}" stroke-opacity=".88" stroke-width="1.45"/>
        <path d="M45 70L58 50L68 43L105 39L121 44L114 70L121 96L105 101L68 97L58 90Z" fill="${innerA}" stroke="${edgeSoft}" stroke-opacity=".46" stroke-width="1"/>
        <path d="M31 70L45 48L50 70L45 92Z" fill="${edge}" fill-opacity=".18"/>
        <path d="M56 34L113 27" stroke="${edge}" stroke-opacity=".32" stroke-width="1"/>
        <path d="M56 106L113 113" stroke="${rail}" stroke-opacity=".26" stroke-width="1"/>

        <path d="M151 35L174 38H828L855 38L916 34L944 43L953 53L945 70L953 87L944 97L916 106L855 102L828 102H174L151 105L161 70Z" fill="${innerA}" fill-opacity=".58"/>
        <rect x="164" y="39" width="720" height="62" rx="8" fill="${innerB}" fill-opacity=".20"/>
        <path d="M166 47H891" stroke="url(#rail)" stroke-width="2.2"/>
        <path d="M171 53H865" stroke="${edgeSoft}" stroke-opacity=".16" stroke-width=".85"/>
        <path d="M178 69H836" stroke="${edge}" stroke-opacity=".09" stroke-width=".8"/>
        <path d="M171 87H875" stroke="${rail}" stroke-opacity=".31" stroke-width="1.05"/>
        <path d="M166 94H894" stroke="url(#rail)" stroke-opacity=".74" stroke-width="1.75"/>

        <path d="M153 30L170 38L159 51" fill="none" stroke="${edge}" stroke-opacity=".36" stroke-width="1.2"/>
        <path d="M153 110L170 102L159 89" fill="none" stroke="${rail}" stroke-opacity=".34" stroke-width="1.2"/>
        <path d="M826 31L846 38L858 49" fill="none" stroke="${edge}" stroke-opacity=".22" stroke-width="1.1"/>
        <path d="M826 109L846 102L858 91" fill="none" stroke="${rail}" stroke-opacity=".22" stroke-width="1.1"/>

        <ellipse cx="742" cy="70" rx="145" ry="41" fill="url(#badgeGlow)"/>
        <path d="M615 40L644 34H824L854 42" fill="none" stroke="${edge}" stroke-opacity=".12" stroke-width="1"/>
        <path d="M615 100L644 106H824L854 98" fill="none" stroke="${rail}" stroke-opacity=".13" stroke-width="1"/>
        <path d="M636 46H836" stroke="${edgeSoft}" stroke-opacity=".08" stroke-width="1"/>
        <path d="M636 94H836" stroke="${railSoft}" stroke-opacity=".08" stroke-width="1"/>

        <path d="M921 28L960 39L974 52L964 70L974 88L960 101L921 112L938 87L932 70L938 53Z" fill="url(#ovr)" stroke="${edge}" stroke-opacity=".74" stroke-width="1.5"/>
        <path d="M946 45L965 52L958 70L965 88L946 95L953 70Z" fill="${edge}" fill-opacity=".14"/>
        <path d="M929 37L955 44" stroke="${edge}" stroke-opacity=".26" stroke-width="1"/>
        <path d="M929 103L955 96" stroke="${rail}" stroke-opacity=".23" stroke-width="1"/>

        <path d="M47 23L116 15L153 22H818" fill="none" stroke="${edge}" stroke-opacity=".22" stroke-width="1.1" filter="url(#softGlow)"/>
        <path d="M153 118H818L852 116L928 122" fill="none" stroke="${rail}" stroke-opacity=".18" stroke-width="1.05"/>
        <path d="M183 29H811" stroke="${edgeSoft}" stroke-opacity=".08" stroke-width="1"/>
        <path d="M183 111H811" stroke="${railSoft}" stroke-opacity=".08" stroke-width="1"/>
      </svg>
    `);
  }

  const bars = Object.freeze({
    most_overall_mvp: premiumBar({ outerA:'#1b1000', outerB:'#8d5800', outerC:'#503000', innerA:'#090500', innerB:'#2b1900', innerC:'#4c2d00', edge:'#ffd95f', edgeSoft:'#fff0a8', rail:'#d79600', railSoft:'#7c4d00', glow:'#ffc834', socket:'#684000', socketDeep:'#100900', ovr:'#4a2d00' }),
    most_team_mvp: premiumBar({ outerA:'#061527', outerB:'#2f78b9', outerC:'#163f70', innerA:'#020913', innerB:'#091a2d', innerC:'#103154', edge:'#d6f3ff', edgeSoft:'#8bd8ff', rail:'#5bbcff', railSoft:'#275c8d', glow:'#62c6ff', socket:'#123c64', socketDeep:'#030b15', ovr:'#153b5d' }),
    best_shooting: premiumBar({ outerA:'#03171d', outerB:'#0d88a4', outerC:'#075565', innerA:'#01090d', innerB:'#062027', innerC:'#0a3641', edge:'#d4fbff', edgeSoft:'#70efff', rail:'#32d5ea', railSoft:'#157181', glow:'#49eaff', socket:'#0b4f5e', socketDeep:'#020c10', ovr:'#0c4755' }),
    best_rebounder: premiumBar({ outerA:'#06142c', outerB:'#315fa8', outerC:'#173a73', innerA:'#020715', innerB:'#07162b', innerC:'#102a55', edge:'#dce9ff', edgeSoft:'#8cb8ff', rail:'#5a87ff', railSoft:'#294b8c', glow:'#658dff', socket:'#173d78', socketDeep:'#030919', ovr:'#173964' }),
    captain_eligible: premiumBar({ outerA:'#03111f', outerB:'#0f77b5', outerC:'#07486f', innerA:'#010811', innerB:'#061724', innerC:'#0a2d49', edge:'#c9f7ff', edgeSoft:'#78e6ff', rail:'#20cfff', railSoft:'#0b6694', glow:'#33bfff', socket:'#0a4165', socketDeep:'#020a12', ovr:'#0b3653' }),
  });

  window.RealPlayWorldPlayerBarVector = Object.freeze({
    bars,
    get(type) {
      return bars[String(type || '').trim().toLowerCase()] || '';
    },
  });

  function activeFilterKey() {
    const active = document.querySelector('.rp-world-player-sort [data-player-sort].active');
    return String(active?.dataset?.playerSort || 'ranked').trim().toLowerCase();
  }

  function syncFilter() {
    document.documentElement.setAttribute(FILTER_ATTRIBUTE, activeFilterKey());
  }

  function vectorForRow(row) {
    return bars[String(row?.dataset?.recognitionType || '').trim().toLowerCase()] || '';
  }

  function applyVectorAuthority(root = document) {
    const rows = [];
    if (root instanceof HTMLElement && root.matches('.rp-world-player-row[data-recognition-type]')) rows.push(root);
    root.querySelectorAll?.('.rp-world-player-row[data-recognition-type]').forEach((row) => rows.push(row));

    rows.forEach((row) => {
      const vector = vectorForRow(row);
      if (!vector) return;
      const value = `url("${vector}")`;
      if (row.style.getPropertyValue('--rp-recognition-bar') === value && row.style.getPropertyPriority('--rp-recognition-bar') === 'important') return;
      row.style.setProperty('--rp-recognition-bar', value, 'important');
    });
  }

  const style = document.createElement('style');
  style.dataset.rpWorldPlayerBarVector = '1';
  style.textContent = `
    .rp-world-player-row.rp-recognition-themed{
      --rp-featured-badge-x:75%;
      --rp-featured-badge-y:42%;
      --rp-featured-badge-width:23.5%;
      border-color:transparent!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    .rp-world-player-row.rp-recognition-themed::after{
      background:linear-gradient(90deg,rgba(1,5,10,.10),rgba(1,5,10,.015) 45%,rgba(1,5,10,.09))!important;
      box-shadow:none!important;
    }
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge{
      left:var(--rp-featured-badge-x)!important;
      right:auto!important;
      top:var(--rp-featured-badge-y)!important;
      width:var(--rp-featured-badge-width)!important;
      height:auto!important;
      aspect-ratio:9/4;
      transform:translate(-50%,-50%)!important;
      transform-origin:center center!important;
    }
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge:hover{transform:translate(-50%,-50%) scale(1.055)!important}
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-badge:active{transform:translate(-50%,-50%) scale(.97)!important}
    .rp-world-player-row.rp-recognition-themed .rp-player-featured-count{right:4px!important;top:-8px!important;bottom:auto!important}
    @media(max-width:420px){.rp-world-player-row.rp-recognition-themed .rp-player-featured-count{right:3px!important;top:-7px!important;bottom:auto!important}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-player-sort]')) requestAnimationFrame(() => {
      syncFilter();
      applyVectorAuthority();
    });
  });

  const observer = new MutationObserver((mutations) => {
    let shouldSync = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) applyVectorAuthority(node);
        });
      } else if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
        if (mutation.target.matches('.rp-world-player-row')) applyVectorAuthority(mutation.target);
        if (mutation.target.matches('[data-player-sort]')) shouldSync = true;
      }
    });
    if (shouldSync) syncFilter();
  });

  observer.observe(document.documentElement, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['data-recognition-type','class','style'],
  });

  syncFilter();
  applyVectorAuthority();
})();
