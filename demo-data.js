window.AD_SIM_DEMO = (() => {
  const now = Date.now();
  const ago = (h) => new Date(now - h * 3600000).toISOString();
  const future = (days) => new Date(now + days * 86400000).toISOString().slice(0,10);

  const ous = [
    {id:1,name:"Employees",parent_id:null,path:"OU=Employees,DC=corp,DC=local",description:"Primary employee container"},
    {id:2,name:"Finance",parent_id:1,path:"OU=Finance,OU=Employees,DC=corp,DC=local",description:"Finance department users"},
    {id:3,name:"Human Resources",parent_id:1,path:"OU=Human Resources,OU=Employees,DC=corp,DC=local",description:"HR department users"},
    {id:4,name:"IT",parent_id:1,path:"OU=IT,OU=Employees,DC=corp,DC=local",description:"IT operations and support users"},
    {id:5,name:"Operations",parent_id:1,path:"OU=Operations,OU=Employees,DC=corp,DC=local",description:"Operations department users"},
    {id:6,name:"Service Accounts",parent_id:null,path:"OU=Service Accounts,DC=corp,DC=local",description:"Non-human service identities"},
    {id:7,name:"Disabled Users",parent_id:null,path:"OU=Disabled Users,DC=corp,DC=local",description:"Offboarded or disabled identities"}
  ];

  const groups = [
    {id:1,name:"GG-All-Employees",type:"Security",owner:"IT Operations",risk:"Low",permission:"Baseline employee resources"},
    {id:2,name:"GG-Finance-Share-RW",type:"Security",owner:"Finance",risk:"Medium",permission:"Finance shared-drive modify access"},
    {id:3,name:"GG-HR-Confidential-RW",type:"Security",owner:"Human Resources",risk:"High",permission:"HR confidential records modify access"},
    {id:4,name:"GG-IT-HelpDesk",type:"Security",owner:"IT Operations",risk:"Medium",permission:"Help desk tools and support resources"},
    {id:5,name:"GG-IT-Admins",type:"Security",owner:"Infrastructure",risk:"High",permission:"Simulated privileged administration"},
    {id:6,name:"GG-Operations-Apps",type:"Security",owner:"Operations",risk:"Medium",permission:"Operations application access"},
    {id:7,name:"DL-All-Employees",type:"Distribution",owner:"Human Resources",risk:"Low",permission:"Company announcements"},
    {id:8,name:"GG-VPN-Users",type:"Security",owner:"Infrastructure",risk:"Medium",permission:"Remote-access entitlement"}
  ];

  const templates = [
    {id:1,name:"Standard Employee",department:"Corporate",ou_id:1,groups:[1,7],permissions:["Baseline employee resources","Company announcements"]},
    {id:2,name:"Finance User",department:"Finance",ou_id:2,groups:[1,2,7],permissions:["Baseline employee resources","Finance shared-drive modify access","Company announcements"]},
    {id:3,name:"HR User",department:"Human Resources",ou_id:3,groups:[1,3,7],permissions:["Baseline employee resources","HR confidential records modify access","Company announcements"]},
    {id:4,name:"IT Support",department:"IT",ou_id:4,groups:[1,4,7,8],permissions:["Baseline employee resources","Help desk tools","Company announcements","Remote-access entitlement"]},
    {id:5,name:"IT Administrator",department:"IT",ou_id:4,groups:[1,4,5,7,8],permissions:["Baseline employee resources","Help desk tools","Privileged administration","Company announcements","Remote-access entitlement"]},
    {id:6,name:"Operations User",department:"Operations",ou_id:5,groups:[1,6,7],permissions:["Baseline employee resources","Operations applications","Company announcements"]}
  ];

  const users = [
    {id:1,first_name:"Adrian",last_name:"Reyes",display_name:"Adrian Reyes",username:"areyes",upn:"areyes@corp.local",department:"Finance",title:"Finance Analyst",ou_id:2,template_id:2,manager:"Carlos Mendoza",status:"Active",enabled:true,groups:[1,2,7],expiry:"",must_reset_password:false,created_at:ago(720),updated_at:ago(2)},
    {id:2,first_name:"Nico",last_name:"Cruz",display_name:"Nico Cruz",username:"ncruz",upn:"ncruz@corp.local",department:"Human Resources",title:"HR Specialist",ou_id:3,template_id:3,manager:"Andres Lim",status:"Active",enabled:true,groups:[1,3,7],expiry:"",must_reset_password:false,created_at:ago(1000),updated_at:ago(6)},
    {id:3,first_name:"Jim",last_name:"Camus",display_name:"Jim Camus",username:"jcamus",upn:"jcamus@corp.local",department:"IT",title:"IT Support Specialist",ou_id:4,template_id:4,manager:"Daniel Reyes",status:"Active",enabled:true,groups:[1,4,7,8],expiry:"",must_reset_password:false,created_at:ago(900),updated_at:ago(1)},
    {id:4,first_name:"Marco",last_name:"Santos",display_name:"Marco Santos",username:"msantos",upn:"msantos@corp.local",department:"Operations",title:"Operations Coordinator",ou_id:5,template_id:6,manager:"Victor Tan",status:"Active",enabled:true,groups:[1,6,7],expiry:"",must_reset_password:false,created_at:ago(500),updated_at:ago(12)},
    {id:5,first_name:"Daniel",last_name:"Lee",display_name:"Daniel Lee",username:"dlee",upn:"dlee@corp.local",department:"IT",title:"Systems Administrator",ou_id:4,template_id:5,manager:"Infrastructure Manager",status:"Active",enabled:true,groups:[1,4,5,7,8],expiry:"",must_reset_password:false,created_at:ago(1500),updated_at:ago(4)},
    {id:6,first_name:"Miguel",last_name:"Torres",display_name:"Miguel Torres",username:"mtorres",upn:"mtorres@corp.local",department:"Marketing",title:"Marketing Associate",ou_id:1,template_id:1,manager:"Marketing Lead",status:"Disabled",enabled:false,groups:[1,7],expiry:"",must_reset_password:false,created_at:ago(600),updated_at:ago(24)},
    {id:7,first_name:"Paolo",last_name:"Garcia",display_name:"Paolo Garcia",username:"pgarcia",upn:"pgarcia@corp.local",department:"Finance",title:"Finance Contractor",ou_id:2,template_id:2,manager:"Carlos Mendoza",status:"Active",enabled:true,groups:[1,2,7],expiry:future(18),must_reset_password:true,created_at:ago(120),updated_at:ago(2)},
    {id:8,first_name:"Leo",last_name:"Ramos",display_name:"Leo Ramos",username:"lramos",upn:"lramos@corp.local",department:"Operations",title:"Operations Associate",ou_id:7,template_id:6,manager:"Victor Tan",status:"Offboarded",enabled:false,groups:[],expiry:"",must_reset_password:false,created_at:ago(1800),updated_at:ago(48)}
  ];

  const audit = [
    {id:1,at:ago(1),actor:"Jim Camus",action:"Group membership reviewed",detail:"jcamus group assignments verified.",user_id:3},
    {id:2,at:ago(2),actor:"Identity Desk",action:"Password reset required",detail:"pgarcia flagged to change temporary password at next sign-in.",user_id:7},
    {id:3,at:ago(4),actor:"Jim Camus",action:"Account updated",detail:"dlee identity attributes reviewed.",user_id:5},
    {id:4,at:ago(24),actor:"Jim Camus",action:"Account disabled",detail:"mtorres account disabled for simulated leave.",user_id:6},
    {id:5,at:ago(48),actor:"Jim Camus",action:"User offboarded",detail:"lramos disabled, memberships removed, and moved to Disabled Users.",user_id:8},
    {id:6,at:ago(120),actor:"Jim Camus",action:"User provisioned",detail:"pgarcia created from Finance User template.",user_id:7}
  ];

  return {generated_at:new Date(now).toISOString(),domain:"corp.local",ous,groups,templates,users,audit};
})();