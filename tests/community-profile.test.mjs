import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,profileError} from '../src/lib/community-profile.mjs';
const valid={name:' Langston ',handle:' @Langston ',website:'digivated.com',bio:' Building ',interests:['AI']};
test('profile normalizes mobile input and bare website addresses',()=>{const p=normalizeProfile(valid);assert.equal(p.handle,'langston');assert.equal(p.website,'https://digivated.com/');assert.equal(p.name,'Langston');assert.equal(p.bio,'Building');});
test('profile explains reserved handles before writing',()=>{for(const handle of ['admin','digivated','support','moderator'])assert.throws(()=>normalizeProfile({...valid,handle}),/reserved/);});
test('profile rejects invalid fields and unsafe website protocols',()=>{for(const website of ['http://example.com','javascript:alert(1)','https://user:password@example.com','https://exa mple.com'])assert.throws(()=>normalizeProfile({...valid,website}),/secure website/);assert.throws(()=>normalizeProfile({...valid,handle:'a'}),/3–24/);assert.throws(()=>normalizeProfile({...valid,name:' '}),/display name/);});
test('database constraints and duplicate handles get actionable feedback',()=>{assert.match(profileError({code:'23514',message:'community_profiles_handle_check'}),/reserved/);assert.match(profileError({code:'23514',message:'community_profiles_website_check'}),/https/);assert.match(profileError({code:'23505'}),/taken/);});
