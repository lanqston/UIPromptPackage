export const projectCategories = ['Apps', 'Websites', 'AI', 'SaaS', 'Digital Products', 'Design', 'Business', 'Creator Tools', 'Productivity', 'Other'];
export const resourceCategories = ['Technology & AI', 'Markets & Investing', 'Tools & Security', 'Design & UX', 'Creator Growth', 'Digital Products'];
const resourceCategoryAliases = {
  'Tech': 'Technology & AI', 'AI': 'Technology & AI',
  'Useful Tools': 'Tools & Security', 'Apps': 'Tools & Security', 'Productivity': 'Tools & Security',
  'UI/UX': 'Design & UX', 'Web': 'Design & UX',
  'Creator Tips': 'Creator Growth', 'Marketing': 'Creator Growth', 'Career': 'Creator Growth', 'Business': 'Creator Growth'
};
export const normalizeResourceCategory = category => resourceCategoryAliases[category] || category || 'Technology & AI';
export const statuses = ['pending', 'approved', 'featured', 'rejected', 'archived'];
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
// `featured` is a moderation promotion from approved, never a submission input.
export const isPublished = project => ['approved', 'featured'].includes(project.status);
export const publicProjects = projects => projects.filter(isPublished).filter(p => safeUrl(p.url)).sort((a,b) => b.date.localeCompare(a.date));

