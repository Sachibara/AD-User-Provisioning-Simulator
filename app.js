(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const qsa = (s,r=document) => [...r.querySelectorAll(s)];
  const pageMeta = {
    dashboard:["Directory overview","Identity Operations"],users:["Directory identities","Users"],
    ous:["Directory structure","Organizational Units"],groups:["Access assignment","Groups"],
    workflows:["User lifecycle","Provisioning Workflows"],templates:["Role-based provisioning","Role Templates"],
    audit:["Traceability","Audit Log"],about:["Project architecture","About Identity Desk"]
  };
  const state = {
    mode:localStorage.getItem("ad_sim_mode") || (location.port==="8830"?"live":"demo"),
    backendUrl:localStorage.getItem("ad_sim_backend_url") || (location.port==="8830"?location.origin:"http://127.0.0.1:8830"),
    data:null,selectedUser:null,lastRefresh:null
  };

  function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
  function initials(a,b){return ((a?.[0]||"")+(b?.[0]||"")).toUpperCase()||"ID"}
  function fmtTime(iso){if(!iso)return "—";const d=new Date(iso),diff=Math.max(0,Date.now()-d.getTime());if(diff<60000)return "just now";if(diff<3600000)return Math.round(diff/60000)+"m ago";if(diff<86400000)return Math.round(diff/3600000)+"h ago";return Math.round(diff/86400000)+"d ago"}
  function toast(title,msg="",type="info"){const n=document.createElement("div");n.className="toast "+type;n.innerHTML="<strong>"+esc(title)+"</strong><span>"+esc(msg)+"</span>";$("toastRegion").appendChild(n);setTimeout(()=>n.remove(),4200)}
  function cloneDemo(){const saved=localStorage.getItem("ad_sim_state");if(saved){try{return JSON.parse(saved)}catch{}}return JSON.parse(JSON.stringify(window.AD_SIM_DEMO))}
  function persistDemo(){if(state.mode==="demo")localStorage.setItem("ad_sim_state",JSON.stringify(state.data))}
  async function fetchJson(path,options={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),options.timeout||10000);try{const r=await fetch(state.backendUrl.replace(/\/$/,"")+path,{...options,signal:c.signal,headers:{"Content-Type":"application/json",...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||d.error||"Request failed ("+r.status+")");return d}finally{clearTimeout(t)}}
  function setMode(kind,title,detail){$("modeDot").className="mode-dot"+(kind?" "+kind:"");$("modeTitle").textContent=title;$("modeDetail").textContent=detail}

  async function loadData(showToast=false){
    if(state.mode==="demo"){state.data=cloneDemo();state.lastRefresh=new Date();setMode("","Browser workspace","Saved locally in this browser");renderAll();if(showToast)toast("Directory refreshed","Browser-saved identity data loaded.");return}
    setMode("","Connecting…",state.backendUrl);
    try{state.data=await fetchJson("/api/bootstrap");state.lastRefresh=new Date();setMode("live","Live simulator",state.backendUrl.replace(/^https?:\/\//,""));renderAll();if(showToast)toast("Directory refreshed","Persistent simulator records loaded.")}
    catch(e){setMode("error","Backend unavailable",state.backendUrl.replace(/^https?:\/\//,""));toast("Could not reach simulator",e.message,"error");if(!state.data){state.data=cloneDemo();renderAll()}}
  }

  function openPage(page){
    qsa("[data-page-panel]").forEach(p=>p.classList.toggle("active",p.dataset.pagePanel===page));
    qsa("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    $("pageEyebrow").textContent=pageMeta[page][0];$("pageTitle").textContent=pageMeta[page][1];$("sidebar").classList.remove("open");
    if(page==="users")renderUsers();if(page==="ous")renderOus();if(page==="groups")renderGroups();if(page==="workflows")renderWorkflows();if(page==="templates")renderTemplates();if(page==="audit")renderAudit();
  }
  qsa("[data-page]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.page)));
  qsa("[data-go]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.go)));
  $("menuButton").addEventListener("click",()=>$("sidebar").classList.toggle("open"));

  function ou(id){return (state.data?.ous||[]).find(x=>x.id===Number(id))}
  function group(id){return (state.data?.groups||[]).find(x=>x.id===Number(id))}
  function template(id){return (state.data?.templates||[]).find(x=>x.id===Number(id))}
  function usernameFor(first,last,excludeId=null){
    const base=((first||"").trim().slice(0,1)+(last||"").trim()).toLowerCase().replace(/[^a-z0-9]/g,"")||"user";
    let candidate=base,n=2;const used=new Set((state.data?.users||[]).filter(u=>u.id!==excludeId).map(u=>u.username.toLowerCase()));
    while(used.has(candidate)){candidate=base+n;n++}return candidate;
  }
  function addAudit(action,detail,userId=null,actor="Jim Camus"){const id=Math.max(0,...(state.data.audit||[]).map(a=>a.id))+1;state.data.audit.unshift({id,at:new Date().toISOString(),actor,action,detail,user_id:userId})}
  function expiringSoon(u){if(!u.expiry)return false;const d=new Date(u.expiry+"T23:59:59"),diff=d-Date.now();return diff>=0&&diff<=30*86400000}

  function renderDashboard(){
    const users=state.data?.users||[],groups=state.data?.groups||[];
    $("statUsers").textContent=users.length;$("statActive").textContent=users.filter(u=>u.status==="Active").length;$("statDisabled").textContent=users.filter(u=>u.status==="Disabled").length;$("statExpiring").textContent=users.filter(expiringSoon).length;$("statGroups").textContent=groups.length;$("userCountBadge").textContent=users.length;
    const hero=users.find(u=>u.status==="Active")||users[0];if(hero){$("heroInitials").textContent=initials(hero.first_name,hero.last_name);$("heroUser").textContent=hero.upn;$("heroRole").textContent=hero.title+" · "+hero.status}
    const statuses=["Active","Disabled","Pending","Offboarded"];
    $("lifecycleBoard").innerHTML=statuses.map(s=>'<div class="life-card"><span>'+s+'</span><strong>'+users.filter(u=>u.status===s).length+'</strong><small>'+({Active:"Enabled identities",Disabled:"Restricted identities",Pending:"Awaiting completion",Offboarded:"Lifecycle complete"}[s])+'</small></div>').join("");
    $("recentActions").innerHTML=(state.data?.audit||[]).slice(0,6).map(a=>'<div class="activity-item"><span class="activity-icon">LOG</span><div><strong>'+esc(a.action)+'</strong><small>'+esc(a.actor+" · "+a.detail)+'</small></div><time>'+fmtTime(a.at)+'</time></div>').join("");
    const dept={};users.filter(u=>u.status!=="Offboarded").forEach(u=>dept[u.department]=(dept[u.department]||0)+1);const entries=Object.entries(dept).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...entries.map(e=>e[1]));$("departmentBars").innerHTML=entries.map(([d,c])=>'<div class="bar-row"><span>'+esc(d)+'</span><div class="bar-track"><i style="width:'+c/max*100+'%"></i></div><strong>'+c+'</strong></div>').join("");
    const risks=[];groups.filter(g=>g.risk==="High").forEach(g=>{const members=users.filter(u=>(u.groups||[]).includes(g.id)&&u.status==="Active");if(members.length)risks.push({g,members})});
    $("riskList").innerHTML=risks.length?risks.map(x=>'<div class="risk-item"><i class="risk-dot high"></i><div><strong>'+esc(x.g.name)+'</strong><small>'+esc(x.members.map(m=>m.username).join(", "))+'</small></div><b>'+x.members.length+' member'+(x.members.length===1?"":"s")+'</b></div>').join(""):'<div class="empty">No active high-impact memberships.</div>';
  }

  function fillFilters(){
    const deps=[...new Set((state.data?.users||[]).map(u=>u.department))].sort(),sel=$("userDepartmentFilter"),cur=sel.value;sel.innerHTML='<option value="all">All departments</option>'+deps.map(d=>'<option>'+esc(d)+'</option>').join("");if(deps.includes(cur))sel.value=cur;
  }
  function renderUsers(){
    fillFilters();const q=$("userSearch").value.trim().toLowerCase(),status=$("userStatusFilter").value,dep=$("userDepartmentFilter").value;
    const list=(state.data?.users||[]).filter(u=>{const o=ou(u.ou_id);const hay=[u.display_name,u.username,u.upn,u.department,u.title,o?.name,u.manager].join(" ").toLowerCase();return(!q||hay.includes(q))&&(status==="all"||u.status===status)&&(dep==="all"||u.department===dep)});
    $("userTableBody").innerHTML=list.length?list.map(u=>'<tr data-id="'+u.id+'"><td><div class="person"><span class="person-avatar">'+initials(u.first_name,u.last_name)+'</span><div><strong>'+esc(u.display_name)+'</strong><small>'+esc(u.manager||"No manager")+'</small></div></div></td><td><strong>'+esc(u.username)+'</strong><br><small>'+esc(u.upn)+'</small></td><td>'+esc(u.department)+'</td><td>'+esc(u.title)+'</td><td>'+esc(ou(u.ou_id)?.name||"—")+'</td><td><span class="status-chip '+u.status.toLowerCase()+'">'+esc(u.status)+'</span></td><td>'+(u.groups||[]).length+'</td><td>'+esc(u.expiry||"—")+'</td></tr>').join(""):'<tr><td colspan="8" class="empty">No users match the filters.</td></tr>';
    qsa("tr[data-id]",$("userTableBody")).forEach(r=>r.addEventListener("click",()=>openUser(Number(r.dataset.id))));
  }

  function renderOuTree(containerId,clickable=false){
    const ous=state.data?.ous||[],children=id=>ous.filter(o=>o.parent_id===id);
    function walk(parent,depth){return children(parent).map(o=>'<div class="'+(clickable?"ou-node":"tree-node")+'" '+(clickable?'data-ou="'+o.id+'"':'')+' style="margin-left:'+(depth*10)+'px"><span>└─</span> <strong>'+esc(o.name)+'</strong></div>'+walk(o.id,depth+1)).join("")}
    $(containerId).innerHTML=walk(null,0);if(clickable)qsa("[data-ou]",$(containerId)).forEach(n=>n.addEventListener("click",()=>showOu(Number(n.dataset.ou))));
  }
  function renderOus(){renderOuTree("ouTree",true)}
  function showOu(id){const o=ou(id);if(!o)return;$("ouDetailTitle").textContent=o.name;const members=(state.data.users||[]).filter(u=>u.ou_id===id);$("ouDetailPanel").className="ou-detail-card";$("ouDetailPanel").innerHTML='<div class="ou-path">'+esc(o.path)+'</div><p>'+esc(o.description||"No description.")+'</p><div class="member-list">'+(members.length?members.map(u=>'<div class="member-row"><span>'+esc(u.display_name)+'</span><strong>'+esc(u.status)+'</strong></div>').join(""):'<div class="empty">No users in this OU.</div>')+'</div>'}

  function renderGroups(){
    const users=state.data?.users||[];
    $("groupGrid").innerHTML=(state.data?.groups||[]).map(g=>{const members=users.filter(u=>(u.groups||[]).includes(g.id));return '<article class="group-card"><div class="group-top"><span class="type-chip">'+esc(g.type)+'</span><span class="risk-chip '+g.risk.toLowerCase()+'">'+esc(g.risk)+' risk</span></div><h3>'+esc(g.name)+'</h3><p>'+esc(g.permission)+'</p><div class="group-meta"><div><span>Owner</span><strong>'+esc(g.owner||"—")+'</strong></div><div><span>Members</span><strong>'+members.length+'</strong></div></div></article>'}).join("");
  }
  function renderTemplates(){
    $("templateGrid").innerHTML=(state.data?.templates||[]).map(t=>'<article class="template-card"><div class="template-top"><span class="type-chip">ROLE</span><span class="risk-chip low">'+(t.groups||[]).length+' groups</span></div><h3>'+esc(t.name)+'</h3><p>'+esc(t.department+" · OU "+(ou(t.ou_id)?.name||"—"))+'</p><div class="template-meta"><div><span>Default OU</span><strong>'+esc(ou(t.ou_id)?.name||"—")+'</strong></div><div><span>Permissions</span><strong>'+(t.permissions||[]).length+'</strong></div></div></article>').join("");
  }
  function renderAudit(){$("auditList").innerHTML=(state.data?.audit||[]).map(a=>'<div class="activity-item"><span class="activity-icon">LOG</span><div><strong>'+esc(a.action)+'</strong><small>'+esc(a.actor+" · "+a.detail)+'</small></div><time>'+fmtTime(a.at)+'</time></div>').join("")}
  function renderWorkflows(){$("workflowTimeline").innerHTML=(state.data?.audit||[]).filter(a=>/provision|offboard|disable|password|enable/i.test(a.action+" "+a.detail)).slice(0,10).map(a=>'<div class="timeline-item"><time>'+fmtTime(a.at)+'</time><span class="timeline-dot"></span><div class="timeline-copy"><strong>'+esc(a.action)+'</strong><small>'+esc(a.detail)+'</small></div></div>').join("")||'<div class="empty">No lifecycle activity yet.</div>'}

  function populateSelects(){
    const ouOptions=(state.data?.ous||[]).map(o=>'<option value="'+o.id+'">'+esc(o.name)+'</option>').join("");
    $("newOu").innerHTML=ouOptions;$("editOu").innerHTML=ouOptions;
    $("newOuParent").innerHTML='<option value="">Domain root</option>'+ouOptions;
    const tOptions='<option value="">No template</option>'+(state.data?.templates||[]).map(t=>'<option value="'+t.id+'">'+esc(t.name)+'</option>').join("");
    $("newTemplate").innerHTML=tOptions;$("editTemplate").innerHTML=tOptions;
    $("offboardSelect").innerHTML=(state.data?.users||[]).filter(u=>u.status!=="Offboarded").map(u=>'<option value="'+u.id+'">'+esc(u.display_name+" · "+u.username)+'</option>').join("");
  }

  async function openUser(id){
    const u=(state.data?.users||[]).find(x=>x.id===id);if(!u)return;state.selectedUser=id;populateSelects();
    $("userDialogTitle").textContent=u.display_name;$("detailAvatar").textContent=initials(u.first_name,u.last_name);$("detailDisplayName").textContent=u.display_name;$("detailUpn").textContent=u.upn;$("detailStatus").textContent=u.status;
    $("editFirstName").value=u.first_name;$("editLastName").value=u.last_name;$("editUsername").value=u.username;$("editUpn").value=u.upn;$("editDepartment").value=u.department;$("editTitle").value=u.title;$("editOu").value=String(u.ou_id);$("editTemplate").value=u.template_id?String(u.template_id):"";$("editManager").value=u.manager||"";$("editExpiry").value=u.expiry||"";
    $("toggleAccountButton").textContent=u.enabled?"Disable":"Enable";$("offboardUserButton").disabled=u.status==="Offboarded";
    $("groupMemberships").innerHTML=(state.data.groups||[]).map(g=>'<label class="check-row"><input type="checkbox" data-group="'+g.id+'" '+((u.groups||[]).includes(g.id)?"checked":"")+'><span>'+esc(g.name)+'</span></label>').join("");
    renderPermissionSummary();$("userDialog").showModal();
  }
  function selectedGroupIds(){return qsa("[data-group]",$("groupMemberships")).filter(x=>x.checked).map(x=>Number(x.dataset.group))}
  function renderPermissionSummary(){const ids=selectedGroupIds();$("permissionSummary").innerHTML=ids.length?ids.map(id=>group(id)).filter(Boolean).map(g=>'<div class="permission-row"><span>'+esc(g.permission)+'</span><strong>'+esc(g.risk)+'</strong></div>').join(""):'<div class="empty">No group-derived permissions.</div>'}
  $("groupMemberships").addEventListener("change",renderPermissionSummary);

  async function saveUser(){
    const u=(state.data?.users||[]).find(x=>x.id===state.selectedUser);if(!u)return;
    const body={first_name:$("editFirstName").value.trim(),last_name:$("editLastName").value.trim(),username:$("editUsername").value.trim(),upn:$("editUpn").value.trim(),department:$("editDepartment").value.trim(),title:$("editTitle").value.trim(),ou_id:Number($("editOu").value),template_id:$("editTemplate").value?Number($("editTemplate").value):null,manager:$("editManager").value.trim(),expiry:$("editExpiry").value,groups:selectedGroupIds()};
    if(state.mode==="live"){try{await fetchJson("/api/users/"+u.id,{method:"PUT",body:JSON.stringify(body)});$("userDialog").close();await loadData();toast("User updated",body.username)}catch(e){toast("Could not update user",e.message,"error")}return}
    Object.assign(u,body,{display_name:body.first_name+" "+body.last_name,updated_at:new Date().toISOString()});addAudit("Account updated",u.username+" identity and memberships updated.",u.id);persistDemo();$("userDialog").close();renderAll();toast("User updated",u.display_name);
  }

  async function resetPassword(){
    const u=(state.data?.users||[]).find(x=>x.id===state.selectedUser);if(!u)return;
    if(state.mode==="live"){try{await fetchJson("/api/users/"+u.id+"/password-reset",{method:"POST",body:"{}"});await loadData();toast("Password reset simulated",u.username+" must change password at next sign-in.")}catch(e){toast("Could not simulate reset",e.message,"error")}return}
    u.must_reset_password=true;u.updated_at=new Date().toISOString();addAudit("Password reset simulated",u.username+" flagged to change temporary password at next sign-in.",u.id);persistDemo();renderAll();toast("Password reset simulated",u.username+" flagged for password change.");
  }

  async function toggleAccount(){
    const u=(state.data?.users||[]).find(x=>x.id===state.selectedUser);if(!u||u.status==="Offboarded")return;const enabled=!u.enabled;
    if(state.mode==="live"){try{await fetchJson("/api/users/"+u.id+"/account",{method:"POST",body:JSON.stringify({enabled})});$("userDialog").close();await loadData();toast(enabled?"Account enabled":"Account disabled",u.username)}catch(e){toast("Could not update account",e.message,"error")}return}
    u.enabled=enabled;u.status=enabled?"Active":"Disabled";u.updated_at=new Date().toISOString();addAudit(enabled?"Account enabled":"Account disabled",u.username+" account "+(enabled?"enabled.":"disabled."),u.id);persistDemo();$("userDialog").close();renderAll();toast(enabled?"Account enabled":"Account disabled",u.username);
  }

  function openNewUser(){populateSelects();$("newUserForm").reset();populateSelects();$("generatedPreview").textContent="Username and UPN will be generated automatically.";$("newUserDialog").showModal()}
  ["newFirstName","newLastName"].forEach(id=>$(id).addEventListener("input",()=>{const f=$("newFirstName").value,l=$("newLastName").value;if(f&&l){const un=usernameFor(f,l);$("generatedPreview").textContent="Generated: "+un+" · "+un+"@"+(state.data?.domain||"corp.local")}}));
  $("newTemplate").addEventListener("change",()=>{const t=template($("newTemplate").value);if(t){$("newDepartment").value=t.department;$("newOu").value=String(t.ou_id)}});

  async function provisionUser(body){
    if(state.mode==="live")return await fetchJson("/api/users",{method:"POST",body:JSON.stringify(body)});
    const username=usernameFor(body.first_name,body.last_name),id=Math.max(0,...state.data.users.map(u=>u.id))+1,t=template(body.template_id);
    const user={id,...body,display_name:body.first_name+" "+body.last_name,username,upn:username+"@"+state.data.domain,status:"Active",enabled:true,groups:t?[...(t.groups||[])]:[],must_reset_password:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    state.data.users.push(user);addAudit("User provisioned",username+" created"+(t?" from "+t.name+" template":"")+".",id);return user;
  }

  $("newUserForm").addEventListener("submit",async e=>{
    e.preventDefault();const body={first_name:$("newFirstName").value.trim(),last_name:$("newLastName").value.trim(),department:$("newDepartment").value.trim(),title:$("newTitle").value.trim(),ou_id:Number($("newOu").value),template_id:$("newTemplate").value?Number($("newTemplate").value):null,manager:$("newManager").value.trim(),expiry:$("newExpiry").value};
    try{const u=await provisionUser(body);if(state.mode==="demo")persistDemo();$("newUserDialog").close();await loadData();openPage("users");toast("User provisioned",u.upn)}catch(err){toast("Could not provision user",err.message,"error")}
  });

  function openOffboard(id=null){populateSelects();if(id)$("offboardSelect").value=String(id);$("offboardDialog").showModal()}
  async function confirmOffboard(){
    const id=Number($("offboardSelect").value),u=(state.data?.users||[]).find(x=>x.id===id);if(!u)return;const body={remove_groups:$("offboardRemoveGroups").checked,move_to_disabled_ou:$("offboardMoveOu").checked};
    if(state.mode==="live"){try{await fetchJson("/api/users/"+id+"/offboard",{method:"POST",body:JSON.stringify(body)});$("offboardDialog").close();$("userDialog").open&&$("userDialog").close();await loadData();toast("User offboarded",u.username)}catch(e){toast("Could not offboard user",e.message,"error")}return}
    u.enabled=false;u.status="Offboarded";if(body.remove_groups)u.groups=[];if(body.move_to_disabled_ou){const disabled=state.data.ous.find(o=>o.name==="Disabled Users");if(disabled)u.ou_id=disabled.id}u.updated_at=new Date().toISOString();addAudit("User offboarded",u.username+" disabled"+(body.remove_groups?", memberships removed":"")+(body.move_to_disabled_ou?", moved to Disabled Users":"")+".",id);persistDemo();$("offboardDialog").close();if($("userDialog").open)$("userDialog").close();renderAll();toast("User offboarded",u.username);
  }

  $("bulkForm").addEventListener("submit",async e=>{
    e.preventDefault();const rows=$("bulkCsv").value.split(/\r?\n/).map(r=>r.trim()).filter(Boolean).map(r=>r.split(",").map(x=>x.trim())).filter(r=>r.length>=4);if(!rows.length){toast("No valid rows","Paste at least one CSV row.","error");return}
    try{
      if(state.mode==="live"){const payload={rows:rows.map(r=>({first_name:r[0],last_name:r[1],department:r[2],title:r[3],ou_name:r[4]||"Employees",template_name:r[5]||""}))};const result=await fetchJson("/api/users/bulk",{method:"POST",body:JSON.stringify(payload)});$("bulkDialog").close();await loadData();toast("Bulk provisioning complete",result.created+" users created.");return}
      let count=0;for(const r of rows){const o=state.data.ous.find(x=>x.name.toLowerCase()===(r[4]||"Employees").toLowerCase())||state.data.ous[0],t=state.data.templates.find(x=>x.name.toLowerCase()===(r[5]||"").toLowerCase());await provisionUser({first_name:r[0],last_name:r[1],department:r[2],title:r[3],ou_id:o.id,template_id:t?.id||null,manager:"",expiry:""});count++}addAudit("Bulk provisioning completed",count+" simulated users provisioned.");persistDemo();$("bulkDialog").close();renderAll();toast("Bulk provisioning complete",count+" users created.");
    }catch(err){toast("Bulk provisioning failed",err.message,"error")}
  });

  $("ouForm").addEventListener("submit",async e=>{
    e.preventDefault();const body={name:$("newOuName").value.trim(),parent_id:$("newOuParent").value?Number($("newOuParent").value):null,description:$("newOuDescription").value.trim()};
    if(state.mode==="live"){try{await fetchJson("/api/ous",{method:"POST",body:JSON.stringify(body)});$("ouDialog").close();await loadData();toast("OU created",body.name)}catch(err){toast("Could not create OU",err.message,"error")}return}
    if(state.data.ous.some(o=>o.name.toLowerCase()===body.name.toLowerCase()&&o.parent_id===body.parent_id)){toast("OU already exists",body.name,"error");return}const parent=ou(body.parent_id),id=Math.max(0,...state.data.ous.map(o=>o.id))+1,path="OU="+body.name+","+(parent?parent.path:"DC=corp,DC=local");state.data.ous.push({id,...body,path});addAudit("OU created",body.name+" created in directory.");persistDemo();$("ouDialog").close();renderAll();toast("OU created",body.name);
  });

  $("groupForm").addEventListener("submit",async e=>{
    e.preventDefault();const body={name:$("newGroupName").value.trim(),type:$("newGroupType").value,owner:$("newGroupOwner").value.trim(),risk:$("newGroupRisk").value,permission:$("newGroupPermission").value.trim()};
    if(state.mode==="live"){try{await fetchJson("/api/groups",{method:"POST",body:JSON.stringify(body)});$("groupDialog").close();await loadData();toast("Group created",body.name)}catch(err){toast("Could not create group",err.message,"error")}return}
    if(state.data.groups.some(g=>g.name.toLowerCase()===body.name.toLowerCase())){toast("Group already exists",body.name,"error");return}const id=Math.max(0,...state.data.groups.map(g=>g.id))+1;state.data.groups.push({id,...body});addAudit("Group created",body.name+" access group created.");persistDemo();$("groupDialog").close();renderAll();toast("Group created",body.name);
  });

  function csvDownload(){const rows=[["DisplayName","Username","UPN","Department","Title","OU","Status","Groups","Expiry"],...(state.data?.users||[]).map(u=>[u.display_name,u.username,u.upn,u.department,u.title,ou(u.ou_id)?.name||"",u.status,(u.groups||[]).map(id=>group(id)?.name||id).join(";"),u.expiry||""])];const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="directory-users.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

  $("saveUserButton").addEventListener("click",saveUser);$("passwordResetButton").addEventListener("click",resetPassword);$("toggleAccountButton").addEventListener("click",toggleAccount);$("offboardUserButton").addEventListener("click",()=>openOffboard(state.selectedUser));$("confirmOffboardButton").addEventListener("click",confirmOffboard);
  $("addUserButton").addEventListener("click",openNewUser);$("newUserTopButton").addEventListener("click",openNewUser);$("startOnboardingButton").addEventListener("click",openNewUser);$("startOffboardingButton").addEventListener("click",()=>openOffboard());$("bulkProvisionButton").addEventListener("click",()=>{$("bulkForm").reset();$("bulkDialog").showModal()});$("addOuButton").addEventListener("click",()=>{populateSelects();$("ouForm").reset();populateSelects();$("ouDialog").showModal()});$("addGroupButton").addEventListener("click",()=>{$("groupForm").reset();$("groupDialog").showModal()});$("exportUsersButton").addEventListener("click",csvDownload);
  $("userSearch").addEventListener("input",renderUsers);$("userStatusFilter").addEventListener("change",renderUsers);$("userDepartmentFilter").addEventListener("change",renderUsers);$("refreshButton").addEventListener("click",()=>loadData(true));

  const conn=$("connectionDialog");$("connectionButton").addEventListener("click",()=>{qsa('input[name="mode"]').forEach(r=>r.checked=r.value===state.mode);$("backendUrlInput").value=state.backendUrl;conn.showModal()});$("saveConnectionButton").addEventListener("click",()=>{const mode=qsa('input[name="mode"]').find(r=>r.checked)?.value||"demo",url=$("backendUrlInput").value.trim().replace(/\/$/,"");if(mode==="live"&&!/^https?:\/\//i.test(url)){toast("Invalid backend URL","Use http://127.0.0.1:8830","error");return}state.mode=mode;state.backendUrl=url||"http://127.0.0.1:8830";localStorage.setItem("ad_sim_mode",mode);localStorage.setItem("ad_sim_backend_url",state.backendUrl);conn.close();state.data=null;loadData(true)});

  function renderAll(){if(!state.data)return;$("lastRefresh").textContent=(state.lastRefresh||new Date()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});populateSelects();renderOuTree("sidebarOuTree");renderDashboard();renderUsers();renderOus();renderGroups();renderWorkflows();renderTemplates();renderAudit()}
  loadData();
})();