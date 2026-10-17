// Derive a public-only light palette from the shared monochrome and dashboard layers.
// Preserve their selector specificity; layouts and interactions stay in the source styles.
import {readFileSync,writeFileSync} from 'node:fs';
import postcss from 'postcss';
const anchors=[[0,255],[16,255],[32,247],[48,229],[64,211],[80,180],[102,142],[128,110],[153,92],[179,80],[204,56],[230,32],[255,17]];
function tone(r,g,b){const l=.2126*r+.7152*g+.0722*b;for(let i=1;i<anchors.length;i++){const [x,y]=anchors[i];if(l<=x){const [a,c]=anchors[i-1];return Math.round(c+(l-a)*(y-c)/(x-a));}}return 17;}
function hex(c){return c.toString(16).padStart(2,'0');}
function palette(value){return value.replace(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\da-f])/gi,(_,h)=>{if(h.length<5)h=[...h].map(c=>c+c).join('');const q=hex(tone(parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)));return '#'+q.repeat(3)+h.slice(6);}).replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*[.\d]+)?\)/g,(_,r,g,b,a='')=>{const q=tone(+r,+g,+b);return `${a?'rgba':'rgb'}(${q},${q},${q}${a})`;}).replace(/\bwhite\b/g,'#111').replace(/\bblack\b/g,'#fff');}
const output=postcss.root();
for(const file of ['monochrome.css','projects-refined.css','resources-refined.css']){
 const input=postcss.parse(readFileSync('src/styles/'+file,'utf8'));
 const visit=(source,parent)=>{for(const node of source.nodes||[]){if(node.type==='atrule'&&node.name==='media'){const media=postcss.atRule({name:'media',params:node.params});visit(node,media);if(media.nodes?.length)parent.append(media);}else if(node.type==='rule'){
 const selectors=postcss.list.comma(node.selector).filter(s=>!s.includes('packet-workspace')&&!s.includes('body.owner')).map(s=>s.replace('html body.platform','html body.platform.light-theme').replace('html body.home-refresh','html body.platform.light-theme.home-refresh').replace('html body.projects-dashboard','html body.platform.light-theme.projects-dashboard')).filter(s=>s.includes('.light-theme'));
 if(!selectors.length)continue;
 const rule=postcss.rule({selector:selectors.join(',\n')});
 for(const d of node.nodes||[]){if(d.type!=='decl'||!(/^(?:--|color$|background|border(?:$|-(?:color|top|bottom|left|right)$)|outline|box-shadow|text-shadow|fill$|stroke$)/.test(d.prop)))continue;const val=palette(d.value);rule.append(d.clone({value:val}));}
 if(rule.nodes?.length)parent.append(rule);
 }}};visit(input,output);
}
const base=`/* Generated palette: node scripts/build-light-theme.mjs. Public pages only. */\nhtml body.platform.light-theme,html body.platform.light-theme.home-refresh { --mono-bg:#fff; --mono-surface:#fff; --mono-raised:#f4f4f4; --mono-line:#dedede; --mono-text:#171717; --mono-muted:#5d5d5d; --color-brand-copy:#424242; --color-brand-focus:#171717; --refined-bg:#fff; --refined-surface:#fff; --refined-raised:#f4f4f4; --refined-line:#dedede; --refined-ink:#171717; --refined-muted:#5d5d5d; --refined-soft:#707070; color-scheme:light; color:#171717; background:#fff; }\n`;
const fixes=`
html body.platform.light-theme :is(h1,h2,h3,h4,h5,h6) { color:#171717; }
html body.platform.light-theme p,html body.platform.light-theme .quiet,html body.platform.light-theme .lede { color:#5d5d5d; }
html body.platform.light-theme :is(input,select,textarea) { background:#fff; color:#242424; border-color:#c9c9c9; }
html body.platform.light-theme :is(input,textarea)::placeholder { color:#737373; }
html body.platform.light-theme a { color:inherit; }
html body.platform.light-theme .x-brand-mark { background:#171717; }
html body.platform.light-theme .platform-header { color:#171717; background:#ffffffed; border-color:#e1e1e1; backdrop-filter:blur(16px); }
html body.platform.light-theme .platform-header .desktop-nav a { color:#555; }
html body.platform.light-theme .platform-header .desktop-nav a[aria-current=page] { color:#111; background:#efefef; }
html body.platform.light-theme .platform-header .header-sign-in { color:#555; }
html body.platform.light-theme .mobile-menu summary { background:#f7f7f7; color:#222; border-color:#ddd; }
html body.platform.light-theme .mobile-menu nav { background:#fff; color:#222; border-color:#ddd; }
html body.platform.light-theme .mobile-menu nav a { color:#333; }
html body.platform.light-theme .mobile-menu nav a:hover,html body.platform.light-theme .mobile-menu nav a[aria-current=page] { background:#f0f0f0; color:#111; }
html body.platform.light-theme .platform-footer { background:#ffffffc9; color:#171717; border-color:#ddd; }
html body.platform.light-theme .platform-footer a,html body.platform.light-theme .platform-footer h2 { color:#333; }
html body.platform.light-theme .welcome-guide,html body.platform.light-theme .idea-card,html body.platform.light-theme .journey-steps li,html body.platform.light-theme .home-product,html body.platform.light-theme .share-next { background:#ffffffdb; border-color:#dedede; }
html body.platform.light-theme .welcome-guide a { color:#222; }
html body.platform.light-theme .welcome-guide small,html body.platform.light-theme .welcome-number { color:#666; }
html body.platform.light-theme .home-topics a { color:#555; }
html body.platform.light-theme .home-topics a:hover { color:#111; background:#fff8; }
html body.platform.light-theme .packet-display { color:#111; background:#f0f0f0; }
html body.platform.light-theme .project-image,html body.platform.light-theme .product-art { background:#f0f0f0; }
html body.platform.light-theme .project-monogram { color:#333; }
html body.platform.light-theme .tag,html body.platform.light-theme .pill { background:#f1f1f1; color:#454545; }
html body.platform.light-theme .comment-dialog,html body.platform.light-theme .collection-dialog { background:#fff; color:#171717; border-color:#ccc; box-shadow:0 20px 80px #0002; }
html body.platform.light-theme .comment-dialog-header { border-color:#ddd; }
html body.platform.light-theme .comment-dialog-header h2 { color:#171717; }
html body.platform.light-theme .comment-dialog-header button { color:#333; background:#f1f1f1; }
html body.platform.light-theme .comment-list li,html body.platform.light-theme .collection-dialog .collection-choice { background:#f5f5f5; color:#333; }
html body.platform.light-theme .comment-list strong,html body.platform.light-theme .comment-list p { color:#333; }
html body.platform.light-theme .comment-form input,html body.platform.light-theme .comment-form textarea,html body.platform.light-theme .collection-dialog input { color:#222; background:#fff; border-color:#ccc; }
html body.platform.light-theme .comment-form button { color:white; background:#171717; }
html body.platform.light-theme .comment-status { color:#555; }
html body.platform.light-theme :is(.saved-empty-panel,.community-empty,.about-values>div,.promo-details>div,.submission-note,.promo-callout) { background:#ffffffd9; color:#222; border-color:#ddd; }
/* Keep the dashboard visit action an open text link, including legacy button states. */
html body.platform.light-theme.projects-dashboard [data-live-projects] .project-copy .card-links .card-open.button,
html body.platform.light-theme.projects-dashboard [data-live-projects] .project-copy .card-links .card-open.button:hover { background:transparent; color:#171717; border:0; box-shadow:none; }
/* Broad silver folds and white highlights retain the flowing reference on small screens. */
html body.platform.light-theme .site-atmosphere {
 background:
  radial-gradient(ellipse 42% 78% at 86% 16%,#ffffff 15%,#ffffff00 70%),
  radial-gradient(ellipse 52% 70% at 10% 8%,#ffffff 20%,#ffffff00 78%),
  radial-gradient(ellipse 48% 88% at 56% 64%,#ffffff00 35%,#c4c4c47a 54%,#e5e5e52e 65%,#ffffff00 78%),
  linear-gradient(125deg,#fff 12%,#ededed 40%,#fafafa 58%,#dedede 76%,#fff 100%);
}
html body.platform.light-theme .site-atmosphere::before {
 width:85vw; height:135vh; left:27%; top:-28%; transform:rotate(-30deg); filter:blur(24px);
 background:radial-gradient(ellipse at 42% 50%,#fff0 31%,#ffffffd9 42%,#bcbcbc70 49%,#e0e0e04d 57%,#fff0 68%);
}
html body.platform.light-theme .site-atmosphere::after {
 width:95vw; height:110vh; left:-42%; top:30%; transform:rotate(32deg); filter:blur(36px);
 background:radial-gradient(ellipse at 60% 48%,#ffffffb3 26%,#cdcdcd80 49%,#fff0 68%);
}
@media(max-width:767px) {
 html body.platform.light-theme .site-atmosphere {
  background:radial-gradient(ellipse 100% 65% at 0% 0%,#fff 15%,#fff0 80%),radial-gradient(ellipse 90% 80% at 100% 100%,#fff 12%,#fff0 78%),linear-gradient(130deg,#fff 8%,#eee 32%,#d6d6d6 54%,#f8f8f8 72%,#fff 96%);
 }
 html body.platform.light-theme .site-atmosphere::before { width:170vw; height:120vh; left:-5%; top:-16%; filter:blur(20px); }
 html body.platform.light-theme .site-atmosphere::after { width:165vw; left:-105%; top:32%; filter:blur(28px); }
}

`;
writeFileSync('src/styles/light-theme.css',base+output.toString()+'\n'+fixes);
