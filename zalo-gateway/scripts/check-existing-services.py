import hashlib,json,os,re,subprocess,sys,urllib.request
from pathlib import Path
root=Path.home()/"m51-ai-server"
prefix=Path(os.environ["PREFIX"])
snapshot=Path(__file__).parent/"artifacts"/"existing-services.private.json"
snapshot.parent.mkdir(mode=0o700,exist_ok=True)
def fetch(url,key=None):
    headers={"Authorization":"Bearer "+key} if key else {}
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=10) as r:
        return json.load(r)
records={}
for name in ["m51-ai","m51-ai-watch","m51-chat","m51-tailscale"]:
    result=subprocess.run([str(prefix/"bin/sv"),"status",str(prefix/"var/service"/name)],capture_output=True,text=True,timeout=10)
    found=re.search(r"\(pid (\d+)\)",result.stdout)
    records[name]={"up":result.returncode==0 and result.stdout.startswith("run:"),"pid":int(found[1]) if found else None}
cli=[str(root/"tailscale/tailscale"),"--socket="+str(root/"run/tailscaled.sock")]
serve=subprocess.check_output(cli+["serve","status","--json"],timeout=10)
state=json.loads(subprocess.check_output(cli+["status","--json"],timeout=10))
key=(root/"secrets/ai-api.key").read_text().strip()
health=fetch("http://127.0.0.1:8080/health",key)
models=fetch("http://127.0.0.1:8080/v1/models",key)
chat=fetch("http://127.0.0.1:8787/api/models")
current={"services":records,"serveHash":hashlib.sha256(serve).hexdigest()}
public={"phase":sys.argv[1],"servicesUp":{k:v["up"] for k,v in records.items()},"aiHealthOk":health.get("status")=="ok","aiModelsPresent":set(["qwen3.5-2b","qwen3-1.7b"]).issubset({m["id"] for m in models["data"]}),"chatModelsPresent":set(["qwen3.5-2b","qwen3-1.7b"]).issubset({m["id"] for m in chat["models"]}),"tailscaleRunning":state.get("BackendState")=="Running","inferenceInvoked":False}
if sys.argv[1]=="before":
    snapshot.write_text(json.dumps(current));snapshot.chmod(0o600)
else:
    before=json.loads(snapshot.read_text())
    public["existingServicePidsUnchanged"]=before["services"]==current["services"]
    public["tailscaleServeConfigurationUnchanged"]=before["serveHash"]==current["serveHash"]
public["status"]="PASS" if all(public["servicesUp"].values()) and all(public[k] for k in ["aiHealthOk","aiModelsPresent","chatModelsPresent","tailscaleRunning"]) and public.get("existingServicePidsUnchanged",True) and public.get("tailscaleServeConfigurationUnchanged",True) else "FAIL"
print(json.dumps(public,indent=2))
if public["status"]!="PASS":sys.exit(1)
