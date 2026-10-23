'use strict';
(() => {
  const game=document.querySelector('#game');
  const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d',{alpha:false});
  const mailbox=document.querySelector('#mailbox'),overlay=document.querySelector('#giftOverlay');
  const chickenHit=document.querySelector('#chickenHit');
  const openGift=document.querySelector('#openGift'),message=document.querySelector('#message');
  const letterOverlay=document.querySelector('#letterOverlay'),closeLetter=document.querySelector('#closeLetter');
  const inventory=document.querySelector('#inventory'),slots=[...document.querySelectorAll('.slot')];
  const tooltip=document.querySelector('#itemTooltip'),music=document.querySelector('#music'),sound=document.querySelector('#sound');
  const itemNames=['梳子','褪黑素','身体乳','贺卡'];
  const assets={};
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state='loading',offset=0,height=432,mailTimer,tooltipTimer,move=null,mailPending=false,chickenPending=false,hbdStarted=false,hbd=null;
  const player={x:183,y:230,direction:0,frame:0};
  const mail={x:72,y:225};
  const chickenHome={x:174,y:340};
  const hbdStrokes=[
    [[78,334],[78,356]],[[78,345],[96,345]],[[96,334],[96,356]],
    [[111,356],[111,334]],[[111,334],[121,334],[126,337],[126,340],[122,344],[111,345]],[[111,345],[122,346],[127,349],[127,352],[123,355],[111,356]],
    [[142,356],[142,334],[150,334],[156,338],[159,344],[159,348],[156,353],[150,356],[142,356]]
  ];
  const solids=[
    {left:78,right:240,top:72,bottom:218},
    {left:0,right:80,top:112,bottom:128},
    {left:18,right:36,top:308,bottom:347},
    {left:220,right:239,top:348,bottom:388},
    {left:68,right:88,top:236,bottom:255},
    {left:3,right:15,top:156,bottom:194}
  ];
  function canStand(x,y){
    const l=x-4,r=x+4,t=y-2,b=y+2;
    const maxY=Math.min(427,height-45);
    return x>=4&&x<=236&&y>=32&&y<=maxY&&
      !solids.some(o=>l<o.right&&r>o.left&&t<o.bottom&&b>o.top);
  }
  function resize(){
    height=Math.round(game.clientHeight/game.clientWidth*240);
    // Keep logical map coordinates and crisp character pixels on phone screens.
    canvas.width=480;canvas.height=height*2;
    ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;
    offset=Math.min(0,Math.round((height-432)*.25));
    const scale=game.clientWidth/240;
    mailbox.style.left=(mail.x-9)*scale+'px';mailbox.style.top=(mail.y+offset-6)*scale+'px';
    mailbox.style.width=40*scale+'px';mailbox.style.height=42*scale+'px';
    chickenHit.style.left=(chickenHome.x-15)*scale+'px';
    chickenHit.style.top=(chickenHome.y+offset-15)*scale+'px';
    chickenHit.style.width=30*scale+'px';chickenHit.style.height=30*scale+'px';
  }
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function showMessage(text,hideAfter=0){clearTimeout(mailTimer);message.textContent=text;message.classList.remove('quiet');if(hideAfter)mailTimer=setTimeout(()=>message.classList.add('quiet'),hideAfter);}
  function setSound(){const playing=!music.paused;sound.setAttribute('aria-pressed',String(playing));sound.setAttribute('aria-label',playing?'暂停背景音乐':'播放背景音乐');sound.textContent=playing?'♫':'♪';}
  function startMusic(){if(music.paused)music.play().catch(()=>showMessage('轻点右上角音符，开启背景音乐。',2500));}
  sound.addEventListener('click',()=>{if(music.paused)startMusic();else music.pause();});
  music.addEventListener('play',setSound);music.addEventListener('pause',setSound);
  function sprite(name,sx,sy,sw,sh,x,y,w=sw,h=sh){if(assets[name])ctx.drawImage(assets[name],sx,sy,sw,sh,Math.round(x),Math.round(y+offset),w,h);}
  function movePlayer(x,y,forMailbox=false){
    if(state==='present'||state==='receiving'||state==='received')return;
    const dx=x-player.x,dy=y-player.y,distance=Math.hypot(dx,dy);
    if(distance<2){if(forMailbox)revealGift();return;}
    state='walking';mailPending=forMailbox;
    player.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?3:1):(dy<0?2:0);
    player.frame=1;
    move={fromX:player.x,fromY:player.y,toX:x,toY:y,start:performance.now(),duration:reduceMotion?0:Math.max(280,distance/92*1000)};
  }
  function beginHbd(){
    if(hbdStarted||state==='present'||state==='receiving'||state==='received')return;
    hbdStarted=true;
    mailPending=false;message.classList.add('quiet');
    chickenPending=true;
    movePlayer(chickenHome.x,chickenHome.y-20);
  }
  function dismissChickenDialog(){
    if(state!=='chickenDialog')return;
    message.classList.add('quiet');state='idle';
    const segments=[];let previous=[chickenHome.x,chickenHome.y];
    for(const stroke of hbdStrokes){
      const first=stroke[0];
      if(previous!==first)segments.push({from:previous,to:first,draw:false});
      for(let i=1;i<stroke.length;i++)segments.push({from:stroke[i-1],to:stroke[i],draw:true});
      previous=stroke[stroke.length-1];
    }
    hbd={segments,start:performance.now()+250,speed:24};
  }
  function chickenPosition(time){
    if(!hbd)return [chickenHome.x,chickenHome.y];
    let distance=(time-hbd.start)/1000*hbd.speed;
    let position=chickenHome;
    for(const segment of hbd.segments){
      const dx=segment.to[0]-segment.from[0],dy=segment.to[1]-segment.from[1],length=Math.hypot(dx,dy);
      if(distance>=length){distance-=length;position=segment.to;continue;}
      const fraction=length?distance/length:1;
      position=[segment.from[0]+dx*fraction,segment.from[1]+dy*fraction];
      return position;
    }
    return position;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(state==='chickenDialog'){dismissChickenDialog();return;}
    if(state==='loading'||state==='present'||state==='receiving'||state==='received'||chickenPending)return;
    const rect=canvas.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*240;
    const y=(event.clientY-rect.top)/rect.height*height-offset;
    if(x>=27&&x<=67&&y>=334&&y<=374)return;
    const movingChicken=chickenPosition(performance.now());
    const fixedChicken=[48,365];
    if([movingChicken,fixedChicken].some(([cx,cy])=>Math.hypot(x-cx,y-cy)<=18)){
      beginHbd();
      return;
    }
    movePlayer(Math.max(4,Math.min(236,x)),Math.max(32,Math.min(Math.min(427,height-45),y)));
  });
  function render(time){
    ctx.fillStyle='#d6ad64';ctx.fillRect(0,0,240,height);
    if(assets.farm&&state!=='loading'){
      // Extend tall viewports using pixels from the original map's ground.
      for(let y=offset+432;y<height;y+=48)ctx.drawImage(assets.farm,80,384,160,32,0,y,240,48);
      ctx.drawImage(assets.farm,0,offset);
      sprite('mailbox',0,0,16,32,mail.x,mail.y);
      if(hbd){
        let distance=(time-hbd.start)/1000*hbd.speed;
        for(const segment of hbd.segments){
          const dx=segment.to[0]-segment.from[0],dy=segment.to[1]-segment.from[1],length=Math.hypot(dx,dy);
          const covered=Math.min(length,distance);
          if(segment.draw&&covered>0){
            const count=Math.ceil(covered/2);
            for(let i=0;i<=count;i++){
              const fraction=Math.min(1,i*2/Math.max(length,1));
              const x=segment.from[0]+dx*fraction,y=segment.from[1]+dy*fraction+offset;
              ctx.drawImage(assets.soil,Math.floor(x-2),Math.floor(y-2),4,4);
            }
          }
          distance-=length;
          if(distance<0)break;
        }
      }
      if(state==='walking'&&move){
        const t=move.duration===0?1:Math.min(1,(time-move.start)/move.duration);
        const nextX=move.fromX+(move.toX-move.fromX)*t;
        const nextY=move.fromY+(move.toY-move.fromY)*t;
        const startX=player.x,startY=player.y;
        const steps=Math.max(1,Math.ceil(Math.hypot(nextX-startX,nextY-startY)/2));
        let blocked=false;
        for(let i=1;i<=steps;i++){
          const fraction=i/steps;
          const x=startX+(nextX-startX)*fraction;
          const y=startY+(nextY-startY)*fraction;
          if(!canStand(x,y)){blocked=true;break;}
          player.x=x;player.y=y;
        }
        if(blocked){move=null;mailPending=false;state='idle';player.frame=0;}
        else{
          player.frame=t===1?0:1+Math.floor(time/145)%3;
          if(t===1){
            move=null;
            if(chickenPending){chickenPending=false;state='chickenDialog';showMessage('小鸡：Cassie，生日快乐！');}
            else if(mailPending){mailPending=false;state='mailbox';revealGift();}
            else state='idle';
          }
        }
      }
      ctx.fillStyle='#453d3244';ctx.fillRect(Math.round(player.x-6),Math.round(player.y+offset-2),13,3);
      sprite('cassie',player.frame*16,player.direction*32,16,32,player.x-8,player.y-31);
      const cf=Math.floor(time/180)%4;
      const bird=chickenPosition(time);
      sprite('chicken',cf*16,0,16,16,bird[0]-8,bird[1]-8);
      sprite('chicken',(3-Math.floor(time/420)%4)*16,16,16,16,48,365+Math.sin(time/2100)*2);
      sprite('cat',0,0,32,32,31,338);
    }
    requestAnimationFrame(render);
  }
  async function revealGift(){
    if(state!=='mailbox')return;
    state='present';mailbox.disabled=true;message.classList.add('quiet');startMusic();
    const scale=game.clientWidth/240;
    game.style.setProperty('--dx',((mail.x+8)*scale-game.clientWidth/2)+'px');
    game.style.setProperty('--dy',((mail.y+offset)*scale-game.clientHeight/2)+'px');
    overlay.hidden=false;openGift.disabled=true;
    await delay(reduceMotion?0:1020);
    openGift.disabled=false;openGift.focus({preventScroll:true});
  }
  mailbox.addEventListener('click',()=>{if(state==='idle'||state==='mailbox')movePlayer(mail.x+24,mail.y+27,true);});
  chickenHit.addEventListener('click',()=>{if(state==='chickenDialog')dismissChickenDialog();else beginHbd();});
  async function receiveGifts(){
    if(state!=='present'||openGift.disabled)return;
    state='receiving';openGift.disabled=true;startMusic();
    const box=openGift.getBoundingClientRect(),bounds=game.getBoundingClientRect();
    overlay.hidden=true;message.classList.add('quiet');
    for(let i=0;i<4;i++){
      const target=slots[i].getBoundingClientRect();
      const icon=slots[i].querySelector('img').cloneNode();icon.hidden=false;icon.className='flying-item';
      const left=box.left-bounds.left+box.width/2-27,top=box.top-bounds.top+box.height/2-27;
      icon.style.left=left+'px';icon.style.top=top+'px';game.append(icon);
      const x=target.left-bounds.left+target.width/2-27-left,y=target.top-bounds.top+target.height/2-27-top;
      if(!reduceMotion){const animation=icon.animate([{transform:'translate(0,0) scale(1.2)',opacity:1},{transform:`translate(${x*.35}px,${y*.3-45}px) scale(1.05)`,opacity:1,offset:.45},{transform:`translate(${x}px,${y}px) scale(.6)`,opacity:1}],{duration:650,easing:'cubic-bezier(.3,.1,.6,1)',fill:'forwards'});await animation.finished;}
      icon.remove();slots[i].querySelector('img').hidden=false;slots[i].querySelector('.quantity').hidden=false;slots[i].classList.add('arrived');slots[i].setAttribute('aria-label',itemNames[i]+'，1 份');
    }
    state='received';inventory.setAttribute('aria-label','背包，4 件物品：梳子、褪黑素、身体乳、贺卡各 1 份');
    showMessage('获得了：梳子、褪黑素、身体乳和贺卡！',5500);
    slots[0].focus({preventScroll:true});
  }
  openGift.addEventListener('click',receiveGifts);
  function hideLetter(){letterOverlay.hidden=true;slots[3].focus({preventScroll:true});}
  closeLetter.addEventListener('click',hideLetter);
  letterOverlay.addEventListener('click',event=>{if(event.target===letterOverlay)hideLetter();});
  letterOverlay.addEventListener('keydown',event=>{if(event.key==='Escape')hideLetter();});
  slots.forEach((slot,i)=>slot.addEventListener('click',()=>{
    slots.forEach(s=>s.classList.remove('selected'));slot.classList.add('selected');
    if(i<4&&!slot.querySelector('img').hidden){
      if(i===3){letterOverlay.hidden=false;closeLetter.focus({preventScroll:true});return;}
      clearTimeout(tooltipTimer);tooltip.textContent=itemNames[i]+' × 1';tooltip.hidden=false;tooltipTimer=setTimeout(()=>{tooltip.hidden=true;},2000);
    }
  }));
  overlay.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();openGift.focus();}});
  new ResizeObserver(resize).observe(game);resize();requestAnimationFrame(render);
  Promise.all(Object.entries({farm:'farm-scene',cassie:'cassie-sprite',mailbox:'mailbox',chicken:'chicken',soil:'tilled-soil',cat:'cat',gift:'birthday-gift'}).map(([key,file])=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{assets[key]=img;resolve();};img.onerror=reject;img.src='/assets/'+file+'.png?v=cassie-13';}))).then(()=>{
    state='idle';mailbox.disabled=false;chickenHit.disabled=false;
  }).catch(()=>{document.querySelector('#loadError').hidden=false;});
})();
