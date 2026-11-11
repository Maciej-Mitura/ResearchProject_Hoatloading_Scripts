from phase6_common import *
name="phase6_seed_validation_20261109"
def sql(value):
 r=cmd(D+['exec','research-poc-postgres-1','psql','-U','poc','-d',name,'-v','ON_ERROR_STOP=1','-At','-c',value]);assert r['exitCode']==0,r['stderr'];return r['stdout']
created=False
try:
 r=cmd(D+['exec','research-poc-postgres-1','createdb','-U','poc',name]);assert r['exitCode']==0,r['stderr'];created=True
 for p in sorted((ROOT/'apps/api/src/db/migrations').glob('*.sql')):
  if p.name.startswith('010'):continue
  sql(p.read_text(encoding='utf-8'))
 migration=(ROOT/'apps/api/src/db/migrations/010_truthful_demo_examples.sql').read_text(encoding='utf-8')
 original=sql("SELECT json_agg(json_build_object('id',id,'sourceHash',md5(source))) FROM script_versions;")
 # Transaction proves customized source/metadata are not superseded; rollback restores fixtures.
 probe=sql("BEGIN; UPDATE script_versions SET source=source || '// user edit' WHERE id='33333333-3333-3333-3333-333333333301'; UPDATE scripts SET name='User custom name' WHERE id='22222222-2222-2222-2222-222222222202';"+migration+"SELECT json_build_object('v1',count(*) FILTER(WHERE version_number=1),'v2',count(*) FILTER(WHERE version_number=2)) FROM script_versions; ROLLBACK;")
 assert '"v2" : 1' in probe,probe
 sql(migration)
 current=json.loads(sql("SELECT json_agg(json_build_object('name',s.name,'version',v.version_number,'source',v.source)) FROM scripts s JOIN script_versions v ON v.id=s.current_version_id;"))
 assert len(current)==3 and all(x['version']==2 for x in current),current
 old=sql("SELECT json_agg(json_build_object('id',id,'sourceHash',md5(source))) FROM script_versions WHERE version_number=1;")
 assert json.loads(original)==json.loads(old)
 sql(migration)
 assert sql('SELECT count(*) FROM script_versions;')=='6'
 save('seed-migration-validation.json',{'status':'PASS','database':'Disposable fresh database created solely for this check, dropped afterward.','allHistoricalVersion1SourcesPreserved':True,'stockDemosSuperseded':3,'customSourceAndMetadataSkipped':True,'repeatedSqlCreatesNoDuplicateVersions':True,'currentDemos':current,'noWorkingDatabaseReset':True})
 print('Migration 010: stock refresh, edited-source/metadata guards, old-source preservation and repeat safety PASS.')
finally:
 if created:
  r=cmd(D+['exec','research-poc-postgres-1','dropdb','-U','poc',name]);save('seed-test-database-cleanup.json',r);assert r['exitCode']==0
