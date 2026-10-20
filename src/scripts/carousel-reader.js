for(const root of document.querySelectorAll('[data-carousel-reader]')) {
  const track=root.querySelector('[data-carousel-track]');
  const slides=[...root.querySelectorAll('[data-carousel-slide]')];
  const controls=root.querySelector('[data-carousel-controls]');
  const previous=root.querySelector('[data-carousel-prev]');
  const next=root.querySelector('[data-carousel-next]');
  const position=root.querySelector('[data-carousel-position]');
  if(!track||!slides.length||!controls||!previous||!next||!position)continue;
  let current=0,frame;
  const update=()=>{
    frame=undefined;const left=track.getBoundingClientRect().left;
    current=slides.reduce((best,slide,i)=>Math.abs(slide.getBoundingClientRect().left-left)<Math.abs(slides[best].getBoundingClientRect().left-left)?i:best,0);
    previous.disabled=current===0;next.disabled=current===slides.length-1;
    position.textContent=`Slide ${current+1} of ${slides.length}`;
  };
  const move=index=>{
    index=Math.max(0,Math.min(slides.length-1,index));
    track.scrollTo({left:track.scrollLeft+slides[index].getBoundingClientRect().left-track.getBoundingClientRect().left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  previous.addEventListener('click',()=>move(current-1));
  next.addEventListener('click',()=>move(current+1));
  track.addEventListener('scroll',()=>{if(frame===undefined)frame=requestAnimationFrame(update);},{passive:true});
  track.addEventListener('keydown',event=>{
    if(event.target!==track)return;
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();move(event.key==='Home'?0:event.key==='End'?slides.length-1:current+(event.key==='ArrowRight'?1:-1));
  });
  window.addEventListener('resize',update,{passive:true});controls.hidden=false;update();
}
