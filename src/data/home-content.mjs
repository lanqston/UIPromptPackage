import { learningPaths } from './learning-paths.mjs';
export const resourceGuides = learningPaths.map(path => ({title:path.label,description:path.description,category:'LEARNING GOAL',icon:path.icon,href:`/resources?path=${path.id}`,label:'See the guides'}));
