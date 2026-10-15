export function normalizeProfile(values) {
 const row = {name:String(values.name||'').trim(),handle:String(values.handle||'').trim().replace(/^@/,'').toLowerCase(),bio:String(values.bio||'').trim(),website:String(values.website||'').trim(),interests:values.interests||[],cover_theme:values.cover_theme||'mint'};
 if(!row.name || row.name.length>60) throw new Error('Enter a display name between 1 and 60 characters.');
 if(!/^[a-z0-9_]{3,24}$/.test(row.handle)) throw new Error('Use 3–24 letters, numbers, or underscores for your handle.');
 if(['admin','digivated','support','moderator'].includes(row.handle)) throw new Error('@'+row.handle+' is reserved. Choose a personal handle, such as langston or digivated_langston.');
 if(row.bio.length>240) throw new Error('Keep your bio to 240 characters or fewer.');
 if(row.website){if(!/^[a-z][a-z0-9+.-]*:/i.test(row.website))row.website='https://'+row.website;try{const u=new URL(row.website);if(u.protocol!=='https:'||!u.hostname.includes('.')||u.username||u.password||/\s/.test(row.website))throw 0;row.website=u.href;}catch{throw new Error('Enter a secure website address, such as https://digivated.com.');}}
 if(row.interests.length>5)throw new Error('Choose up to five interests.');
 return row;
}
export function profileError(error){
 if(error.code==='23505')return 'That handle is already taken. Choose another and save again.';
 if(error.code==='23514'){const message=error.message||'';if(message.includes('handle'))return 'That handle is reserved or invalid. Use 3–24 lowercase letters, numbers, or underscores; admin, digivated, support, and moderator are reserved.';if(message.includes('website'))return 'Use a website address beginning with https://, or leave Website empty.';return 'Check your profile fields and try again. Your changes are still here.';}
 if(error.code==='42501')return 'Your profile could not be saved with this session. Sign out and log in again.';
 return error.message||'Could not save your profile. Your changes are still here. Please try again.';
}
