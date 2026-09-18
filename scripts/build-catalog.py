"""Build local resource catalogs. No player profile is included in output."""
import pathlib,sqlite3,json,re,sys,hashlib,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[1]
objects={}
for p in pathlib.Path(sys.argv[1]).glob('*.om.xml'):
 o=ET.fromstring(re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]','',p.read_text(encoding='utf8'))).find('object')
 objects[int(o.get('id').split('.')[0])]=o
def fnv(s):
 h=14695981039346656037
 for c in s.encode():h=((h^c)*1099511628211)&((1<<64)-1)
 return h
def val(o,k):
 p=o.find(f"property[@id='{k}']");return None if p is None else p.get('value')
def ref(o,k):return o.find(f"property[@id='{k}']//property[@id='Object']").get('value')
types={'SeasonalEvent':0,'Trial':1,'PRStunt':2,'ForzathonDaily':4,'ForzathonWeekly':5,'MonthlyRival':6,'PhotoChallenge':9,'TreasureChest':10,'HorizonOpen':12,'Eliminator':13,'Collectibles':14,'StuntParty':15,'HideSeek':17,'SeasonalJob':18,'HorizonLifeEvent':22}
seasons=['Summer','Autumn','Winter','Spring'];cn=['夏季','秋季','冬季','春季'];seasonmap={}
for o in objects.values():
 if o.get('type')!='FestivalPassEventInfo':continue
 m=re.search(r'Series(\d+)\\FestivalPlaylist\\(Summer|Autumn|Winter|Spring)',val(o,'ImagePath') or '')
 if m:seasonmap[ref(o,'LocalSeasonInstance')]=(int(m[1]),seasons.index(m[2]))
pointobj=next(o for o in objects.values() if o.get('type')=='FestivalPassPointsSettings')
points={m.find('key').get('value'):int(val(m.find('value'),'Points')) for m in pointobj.findall('property/map_element/value/map_element')}
eventmap=next(o for o in objects.values() if o.get('type')=='FestivalPassEventDataMap')
names=['','WELCOME TO JAPAN','HORIZON DECADES','ITALIAN EXOTICS','MASCOT PARTY','BRITISH AUTOMOTIVE']
weeks=[]
for m in eventmap.findall('property/map_element'):
 guid=m.find('key').get('value')
 if guid not in seasonmap:continue
 s,w=seasonmap[guid];local=objects[fnv(guid)];events={}
 def add(t,i,source):
  events[(t,i)]={'type':types[t],'id':f'0x{i:016x}','name':t,'points':points[t]*(7 if t=='ForzathonDaily' else 1),'parts':7 if t=='ForzathonDaily' else 4 if t=='ForzathonWeekly' else 0,'source':source}
 for r in m.findall("value//property[@id='Object']"):
  o=objects[fnv(r.get('value'))];t=val(o,'EventType');v=val(o,'EventId')
  if t=='TreasureChest':continue
  if t not in types:raise ValueError(t)
  add(t,int(v) if v.isdigit() else fnv(v),v)
 for f,t in [('ForzathonDailySchedule','ForzathonDaily'),('ForzathonWeeklySchedule','ForzathonWeekly')]:
  v=ref(local,f);add(t,fnv(v),v)
 for r in local.findall("property[@id='TreasureChests']/element"):
  v=r.get('value');add('TreasureChest',int(v),v)
 weeks.append({'key':f'{s}:{w}','series':s,'week':w,'season':cn[w],'seasonEn':seasons[w],'title':names[s],'maxPoints':sum(e['points'] for e in events.values()),'events':list(events.values())})
weeks.sort(key=lambda w:(w['series'],w['week']))
(root/'data/seasons.json').write_text(json.dumps({'version':1,'resourceBuild':'2.440.853.0','weeks':weeks},ensure_ascii=False,separators=(',',':')),encoding='utf8')
db=sqlite3.connect(sys.argv[2]);db.row_factory=sqlite3.Row
parts=[dict(r) for r in db.execute('select * from Data_UpgradePart where Id<47')]
tables={p['TableName']:[dict(r) for r in db.execute('select * from '+p['TableName']+' where IsStock=1')] for p in parts}
invalid={(r[0],r[1]) for r in db.execute('select Ordinal,PartEnumValue from CarInvalidDefaultParts')}
excluded={r[0] for r in db.execute('select Ordinal from UnobtainableCars')}|{r[0] for r in db.execute('select CarId from TrafficCars')}
makes={r['ID']:r['IconPathBase'] for r in db.execute('select * from List_CarMake')}
garageCols=[r[1] for r in db.execute('pragma table_info(NewProfile_Career_Garage)')]
cars=[];errors=[]
for car in db.execute('select * from Data_Car order by Id'):
 car=dict(car);cid=car['Id']
 if cid in excluded or not car['IsDrivable'] or not car['IsInstalled']:continue
 default={};groups={'Car':cid};selected={};issues=[]
 for p in parts:
  cat=p['CategoryName'];group=groups.get(cat,-1);column='Ordinal' if cat=='Car' else cat+'ID'
  candidates=[r for r in tables[p['TableName']] if next((v for k,v in r.items() if k.lower()==column.lower()),None)==group] if group!=-1 else []
  if (cid,p['Id']) in invalid:candidates=[]
  if len(candidates)>1:
   candidates.sort(key=lambda r:(r.get('Level',0),r['Id']))
  selected[p['PartName']]=candidates[0] if candidates else None
  default[p['PartName']]=candidates[0]['Id'] if candidates else -1
  if not candidates and not p['OkIfNoStockPart'] and group!=-1 and (cid,p['Id']) not in invalid:issues.append(p['PartName'])
  if p['PartName'] in ['Engine','Drivetrain','CarBody','Motor']:
   groups[p['PartName']]=next((v for k,v in candidates[0].items() if k.lower()==(p['PartName']+'ID').lower()),-1) if candidates else -1
 row={k:car[k] for k in garageCols if k in car and k!='Id'}
 row.update(default)
 row.update({'CarId':cid,'PartsValue':0,'PeakIntakePSI':0,'TopSpeed':0,'Flags':8,'NumOwners':1,'WheelStyle':-1,'WheelStyleRear':-1,'DefaultManufacturerColorIndex':0,'LiveryFileName':'','TuneFileName':'','VersionedTuneId':'00000000-0000-0000-0000-000000000000','VersionedLiveryId':'00000000-0000-0000-0000-000000000000','HasCurrentOwnerViewedCar':0,'SharedID':0,'FrontTireAspectRatioOffset':default['FrontAspectRatio'],'RearTireAspectRatioOffset':default['RearAspectRatio']})
 for k in garageCols:
  if k.startswith('Tuning_'):row[k]=-1
  if k in ['DistanceDriven','TimeDriven','TotalWinnings','TotalRepairs','NumVictories','NumPodiums','NumRaces','NumTimesSold','TimeDrivenInRoadTrips','CurOwnerNumRaces','CurOwnerWinnings','NumSkillPointsEarned','HighestSkillScore']:row[k]=0
 if issues:errors.append({'id':cid,'issues':issues});continue
 media=car['MediaName'].split('_');name=' '.join(media[1:-1]) if len(media)>2 else car['MediaName']
 cars.append({'id':cid,'year':car['Year'],'make':makes.get(car['MakeID'],'Unknown'),'name':name,'media':car['MediaName'],'classId':car['ClassID'],'pi':car['PI'],'contentId':car['ContentId'],'row':row})
out={'version':1,'resourceBuild':'2.440.853.0','dbSha256':hashlib.sha256(pathlib.Path(sys.argv[2]).read_bytes()).hexdigest(),'cars':cars,'excluded':sorted(excluded),'unresolved':errors}
(root/'data/cars.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({'weeks':len(weeks),'totals':{s:sum(w['maxPoints'] for w in weeks if w['series']==s) for s in range(1,6)},'cars':len(cars),'unresolved':errors},indent=2))
