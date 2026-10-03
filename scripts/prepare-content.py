"""Convert the owner's extracted playbook into public samples and private source.
Run: python3 scripts/prepare-content.py /path/to/playbook-source.txt
Full content stays in ignored .private; seal-content.mjs encrypts it for publishing.
"""
import json,re,sys
from pathlib import Path
source=Path(sys.argv[1]).read_text()
source=re.sub(r'^<PARSED TEXT FOR PAGE:.*\n|^UI PROMPTING PLAYBOOK • EXPANDED DRAFT\n|^Indie App Builder Series • Page \d+\n','',source,flags=re.M).replace('\ufffe','').replace('\ufffd','').replace('￾','-')
categories=[(1,'Audit & Diagnosis'),(6,'Layout & Hierarchy'),(10,'Navigation & Information Architecture'),(14,'Mobile & Responsive'),(19,'Color & Typography'),(23,'Components & Design System'),(27,'Forms & Authentication'),(31,'Onboarding'),(34,'States & Feedback'),(38,'Dashboards & Data'),(42,'Accessibility'),(46,'AI-Look Cleanup & Copy'),(50,'Testing & Final Polish'),(55,'Search & Discovery'),(59,'Collaboration & Social UI'),(63,'Monetization & Upgrade UX'),(67,'Localization & Content Resilience'),(70,'Trust, Privacy & Sensitive Actions'),(73,'Interaction Feedback & Motion')]
heads=['WHAT THIS HELPS WITH','WHEN TO USE IT','WHAT TO GIVE THE AI','COPY + PASTE PROMPT','A GOOD RESULT SHOULD','BEGINNER WATCH-OUT','USEFUL FOLLOW-UPS']
matches=list(re.finditer(r'^Prompt (\d{2}) — (.+)$',source,re.M))
assert len(matches)==75
prompts=[]
for i,m in enumerate(matches):
    num=int(m[1]); end=matches[i+1].start() if i+1<len(matches) else source.index('Worked examples:')
    body=source[m.end():end]
    for _,cat in categories:
        body=body.split('\n'+cat+'\n')[0]
    fields={}
    parts=re.split('('+ '|'.join(re.escape(h) for h in heads)+')',body)
    for j in range(1,len(parts),2): fields[parts[j]]=parts[j+1].strip()
    p={'id':num,'title':m[2],'category':next(c for n,c in reversed(categories) if num>=n),'summary':re.sub(r'\s+',' ',fields['WHAT THIS HELPS WITH']),'when':fields['WHEN TO USE IT'],'context':fields['WHAT TO GIVE THE AI'],'prompt':fields['COPY + PASTE PROMPT'],'result':fields['A GOOD RESULT SHOULD'],'followups':fields.get('USEFUL FOLLOW-UPS',''),'watchout':fields.get('BEGINNER WATCH-OUT','')}
    assert len(p['prompt'])>300,(num,p)
    prompts.append(p)
workflow_text=source.split('\nGuided workflows\n')[1].split('\nQuick review checklists\n')[0]
workflows=[]
for i,b in enumerate(re.split(r'\n(?=My |I am |I keep )',workflow_text)):
    lines=b.strip().splitlines(); title=lines.pop(0)
    if not (title.startswith('My ') or title.startswith('I ')):continue
    workflows.append({'id':len(workflows)+1,'title':title,'steps':[int(n) for n in re.findall(r'^\d+\. Prompt (\d+)',b,re.M)],'stop':'Stop when the original goal works, the highest-impact issues are resolved, and QA finds no blocking regressions. Save preference-only ideas for later.'})
assert len(workflows)==8
check_text=source.split('\nQuick review checklists\n')[1].split('\nWhen the AI gives you a bad result\n')[0]
checks=[]
for line in check_text.splitlines():
    if not line.strip():continue
    if line.startswith(' □ '):checks[-1]['items'].append(line[4:].strip())
    else:checks.append({'id':len(checks)+1,'title':line.strip(),'items':[]})
assert len(checks)==8 and all(c['items'] for c in checks)
learn=[{'id':1,'title':'UI basics without the jargon','body':source.split('UI basics without the jargon\n')[1].split('\nAudit & Diagnosis')[0]}, {'id':2,'title':'Worked examples','body':source.split('Worked examples:')[1].split('\nPrompt modifiers:')[0].replace('what improvement actually \nlooks like\n','')}, {'id':3,'title':'Prompt modifiers','body':source.split('Prompt modifiers:')[1].split('\nGuided workflows')[0]}, {'id':4,'title':'When the AI gives you a bad result','body':source.split('\nWhen the AI gives you a bad result\n')[1].split('\nPlain-English glossary')[0]}, {'id':5,'title':'Plain-English glossary','body':source.split('\nPlain-English glossary\n')[1].split('\nA simple way')[0]}]
full={'version':1,'prompts':prompts,'workflows':workflows,'checklists':checks,'lessons':learn}
Path('.private/content.json').write_text(json.dumps(full,ensure_ascii=False))
samples={1,14,46}
demo={**full,'prompts':[p for p in prompts if p['id'] in samples],'workflows':workflows[:1],'checklists':checks[:1],'lessons':learn[:1]}
Path('src/data/demo.json').write_text(json.dumps(demo,ensure_ascii=False,indent=2))
catalog={'prompts':[{k:p[k] for k in ['id','title','category','summary']} for p in prompts],'workflows':[{k:p[k] for k in ['id','title']} for p in workflows],'checklists':[{k:p[k] for k in ['id','title']} for p in checks],'lessons':[{k:p[k] for k in ['id','title']} for p in learn]}
Path('src/data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
print('Recovered',len(prompts),'prompts,',len(workflows),'workflows,',len(checks),'checklists. Public demo: prompts 1, 14, 46.')
