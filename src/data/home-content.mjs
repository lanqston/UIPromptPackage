// Presentation-only examples. These never enter the submission store or view analytics.
export const seedProjects = [
  { id:'demo-pramo', name:'Project Pramo', category:'AI', creator:'Demo maker', description:'A calmer workspace for turning a rough idea into your next useful prompt.', likes:12, artwork:'prompt', status:'featured', pick:false },
  { id:'demo-orbit', name:'Orbit Workspace', category:'Productivity', creator:'Demo maker', description:'Bring tasks, notes, and the next small step into one focused dashboard.', likes:28, artwork:'dashboard', status:'approved', pick:true },
  { id:'demo-frame', name:'Frame Studio', category:'Design', creator:'Demo maker', description:'A collection of considered interfaces and reusable building blocks.', likes:24, artwork:'layout', status:'featured', pick:true },
  { id:'demo-launch', name:'Launch Notes', category:'Creator Tools', creator:'Demo maker', description:'Share the process, collect feedback, and document what you learn.', likes:16, artwork:'notes', status:'approved', pick:false },
  { id:'demo-form', name:'Form & Function', category:'Websites', creator:'Demo maker', description:'Simple forms and thoughtful details for a better first impression.', likes:19, artwork:'layout', status:'approved', pick:true },
  { id:'demo-signal', name:'Signal Board', category:'SaaS', creator:'Demo maker', description:'A clear overview of the numbers that matter to your next launch.', likes:32, artwork:'dashboard', status:'featured', pick:false },
  { id:'demo-pocket', name:'Pocket Library', category:'Digital Products', creator:'Demo maker', description:'A small home for the templates, tools, and ideas worth keeping.', likes:21, artwork:'notes', status:'approved', pick:false },
  { id:'demo-flow', name:'Flow Companion', category:'AI', creator:'Demo maker', description:'Make room for better ideas with a guided creative workflow.', likes:36, artwork:'prompt', status:'approved', pick:true },
];
export const resourceGuides = [
  { title:'AI', description:'Tools and ideas for working with artificial intelligence.', category:'RESOURCE TOPIC', href:'/resources?category=AI', label:'Browse AI resources' },
  { title:'UI/UX', description:'Practical ways to make digital experiences easier to use.', category:'RESOURCE TOPIC', href:'/resources?category=UI%2FUX', label:'Browse UI/UX resources' },
  { title:'Productivity', description:'Useful approaches to organizing work and making progress.', category:'RESOURCE TOPIC', href:'/resources?category=Productivity', label:'Browse productivity' },
  { title:'Digital Products', description:'Resources for turning your knowledge into something useful.', category:'RESOURCE TOPIC', href:'/resources?category=Digital%20Products', label:'Browse digital products' },
];
