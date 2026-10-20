// One suggested sequence per goal. Existing categories and resource URLs stay valid.
export const learningPaths = [
 { id:'ai-tools', keywords:'technology AI apps tools agents automation productivity', label:'Use AI & choose tools', icon:'cpu', description:'Choose a useful tool, check AI answers, then explore automation.', slugs:['make-sense-of-new-tech','choose-tools-that-earn-their-place','use-ai-with-better-judgment','check-an-ai-answer-before-you-use-it','give-ai-agents-clear-boundaries','read-a-tech-launch-with-a-clear-head'] },
 { id:'it-skills', keywords:'IT career careers certification certifications support security accounts', label:'Build IT skills', icon:'tool', description:'Practice a support case and learn how to protect important accounts.', slugs:['tech-career-starter-linkbook','a-gentle-security-reset-for-your-accounts'] },
 { id:'game-dev', keywords:'game games development Roblox Godot arcade', label:'Make a game', icon:'layers', description:'Plan a small arcade game, then use the docs to build and test it.', slugs:['build-a-small-game-you-can-finish','game-dev-resource-linkbook'] },
 { id:'markets', keywords:'markets investing investments fees risk finance', label:'Understand markets', icon:'chart', description:'Understand an investment, check costs, and question performance claims.', slugs:['investing-basics-linkbook','what-investment-fees-change','read-market-claims-clearly'] },
 { id:'design', keywords:'design UX UI forms accessibility', label:'Improve a design', icon:'sparkle', description:'Make a form easier to finish, including when something goes wrong.', slugs:['design-one-small-flow-at-a-time'] },
 { id:'creator', keywords:'creator growth content threads carousels products audience', label:'Share & grow your work', icon:'book', description:'Explain a product, write a useful thread, and understand your audience.', slugs:['make-a-digital-product-easier-to-understand','turn-a-project-into-a-useful-thread','make-a-carousel-people-can-follow','grow-a-small-account-with-real-conversations'] },
];
const categoryGoals = {'Technology & AI':'ai-tools','Tools & Security':'ai-tools','Markets & Investing':'markets','Design & UX':'design','Creator Growth':'creator','Digital Products':'creator'};
export function resourcePathInfo(resource) {
 const slug=resource.slug || (resource.url?.startsWith('/resources/') ? resource.url.split('/')[2]?.split(/[?#]/)[0] : resource.id);
 let path=learningPaths.find(p=>p.slugs.includes(slug));
 if(!path)path=learningPaths.find(p=>p.id===categoryGoals[resource.category]);
 const index=path?.slugs.indexOf(slug) ?? -1;
 const paid=Boolean(resource.packet || resource.id==='builtin-ui-ux-prompt-packet');
 return {path,step:index>=0?index+1:null,total:path?.slugs.length||0,next:index>=0?path.slugs[index+1]||null:null,order:paid?100000:path?learningPaths.indexOf(path)*100+(index>=0?index:99):9999};
}
