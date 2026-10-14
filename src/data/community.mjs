export const projectCategories = ['Apps', 'Websites', 'AI', 'SaaS', 'Digital Products', 'Design', 'Business', 'Creator Tools', 'Productivity', 'Other'];
export const resourceCategories = ['Tech', 'AI', 'Markets & Investing', 'Useful Tools', 'Apps', 'UI/UX', 'Web', 'Productivity', 'Career', 'Business', 'Marketing', 'Creator Tips', 'Digital Products'];
export const statuses = ['pending', 'approved', 'featured', 'rejected', 'archived'];
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
// `featured` is a moderation promotion from approved, never a submission input.
export const isPublished = project => ['approved', 'featured'].includes(project.status);
export const publicProjects = projects => projects.filter(isPublished).filter(p => safeUrl(p.url)).sort((a,b) => b.date.localeCompare(a.date));

