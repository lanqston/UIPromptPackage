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
  { title:'Give your next idea a clearer starting point.', description:'Explore the UI/UX Prompt Packet, with customizable prompts and step-by-step guidance.', category:'UI/UX', href:'/ui-ux-prompt-packet', label:'Explore the packet', artwork:'layout' },
  { title:'Find a workflow that works for you.', description:'Browse the productivity collection for practical tools and useful approaches.', category:'Productivity', href:'/resources?category=Productivity', label:'Browse productivity', artwork:'dashboard' },
  { title:'Build something useful with AI.', description:'Discover the AI resource collection and find a new direction for your next project.', category:'AI', href:'/resources?category=AI', label:'Explore AI resources', artwork:'prompt' },
  { title:'Turn what you know into something shareable.', description:'Explore digital products and resources made for independent builders.', category:'Digital Products', href:'/products', label:'Discover products', artwork:'notes' },
];
