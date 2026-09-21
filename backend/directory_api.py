from __future__ import annotations

import json
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DATA_DIR / "directory.db"
DOMAIN = "corp.local"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ous(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parent_id INTEGER,
                path TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                UNIQUE(name,parent_id),
                FOREIGN KEY(parent_id) REFERENCES ous(id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS groups(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL,
                owner TEXT NOT NULL DEFAULT '',
                risk TEXT NOT NULL DEFAULT 'Low',
                permission TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS templates(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                department TEXT NOT NULL,
                ou_id INTEGER NOT NULL,
                groups_json TEXT NOT NULL DEFAULT '[]',
                permissions_json TEXT NOT NULL DEFAULT '[]',
                FOREIGN KEY(ou_id) REFERENCES ous(id)
            );

            CREATE TABLE IF NOT EXISTS users(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                upn TEXT NOT NULL UNIQUE,
                department TEXT NOT NULL,
                title TEXT NOT NULL,
                ou_id INTEGER NOT NULL,
                template_id INTEGER,
                manager TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Active',
                enabled INTEGER NOT NULL DEFAULT 1,
                expiry TEXT NOT NULL DEFAULT '',
                must_reset_password INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(ou_id) REFERENCES ous(id),
                FOREIGN KEY(template_id) REFERENCES templates(id)
            );

            CREATE TABLE IF NOT EXISTS user_groups(
                user_id INTEGER NOT NULL,
                group_id INTEGER NOT NULL,
                PRIMARY KEY(user_id,group_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                at TEXT NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                detail TEXT NOT NULL,
                user_id INTEGER,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            );
            """
        )
        seed(conn)
        conn.commit()


def seed(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT 1 FROM ous LIMIT 1").fetchone():
        return

    ous = [
        ("Employees",None,"OU=Employees,DC=corp,DC=local","Primary employee container"),
        ("Finance",1,"OU=Finance,OU=Employees,DC=corp,DC=local","Finance department users"),
        ("Human Resources",1,"OU=Human Resources,OU=Employees,DC=corp,DC=local","HR department users"),
        ("IT",1,"OU=IT,OU=Employees,DC=corp,DC=local","IT operations and support users"),
        ("Operations",1,"OU=Operations,OU=Employees,DC=corp,DC=local","Operations department users"),
        ("Service Accounts",None,"OU=Service Accounts,DC=corp,DC=local","Non-human service identities"),
        ("Disabled Users",None,"OU=Disabled Users,DC=corp,DC=local","Offboarded or disabled identities"),
    ]
    for row in ous:
        conn.execute("INSERT INTO ous(name,parent_id,path,description) VALUES(?,?,?,?)", row)

    groups = [
        ("GG-All-Employees","Security","IT Operations","Low","Baseline employee resources"),
        ("GG-Finance-Share-RW","Security","Finance","Medium","Finance shared-drive modify access"),
        ("GG-HR-Confidential-RW","Security","Human Resources","High","HR confidential records modify access"),
        ("GG-IT-HelpDesk","Security","IT Operations","Medium","Help desk tools and support resources"),
        ("GG-IT-Admins","Security","Infrastructure","High","Simulated privileged administration"),
        ("GG-Operations-Apps","Security","Operations","Medium","Operations application access"),
        ("DL-All-Employees","Distribution","Human Resources","Low","Company announcements"),
        ("GG-VPN-Users","Security","Infrastructure","Medium","Remote-access entitlement"),
    ]
    conn.executemany("INSERT INTO groups(name,type,owner,risk,permission) VALUES(?,?,?,?,?)", groups)

    templates = [
        ("Standard Employee","Corporate",1,[1,7],["Baseline employee resources","Company announcements"]),
        ("Finance User","Finance",2,[1,2,7],["Baseline employee resources","Finance shared-drive modify access","Company announcements"]),
        ("HR User","Human Resources",3,[1,3,7],["Baseline employee resources","HR confidential records modify access","Company announcements"]),
        ("IT Support","IT",4,[1,4,7,8],["Baseline employee resources","Help desk tools","Company announcements","Remote-access entitlement"]),
        ("IT Administrator","IT",4,[1,4,5,7,8],["Baseline employee resources","Help desk tools","Privileged administration","Company announcements","Remote-access entitlement"]),
        ("Operations User","Operations",5,[1,6,7],["Baseline employee resources","Operations applications","Company announcements"]),
    ]
    for name,department,ou_id,group_ids,permissions in templates:
        conn.execute(
            "INSERT INTO templates(name,department,ou_id,groups_json,permissions_json) VALUES(?,?,?,?,?)",
            (name,department,ou_id,json.dumps(group_ids),json.dumps(permissions)),
        )

    now = utc_now()
    users = [
        ("Alyssa","Reyes","areyes","Finance","Finance Analyst",2,2,"Carla Mendoza","Active",1,"",0,[1,2,7]),
        ("Nina","Cruz","ncruz","Human Resources","HR Specialist",3,3,"Andrea Lim","Active",1,"",0,[1,3,7]),
        ("Jim","Camus","jcamus","IT","IT Support Specialist",4,4,"Daniel Reyes","Active",1,"",0,[1,4,7,8]),
        ("Marco","Santos","msantos","Operations","Operations Coordinator",5,6,"Victor Tan","Active",1,"",0,[1,6,7]),
        ("Daniel","Lee","dlee","IT","Systems Administrator",4,5,"Infrastructure Manager","Active",1,"",0,[1,4,5,7,8]),
        ("Mika","Torres","mtorres","Marketing","Marketing Associate",1,1,"Marketing Lead","Disabled",0,"",0,[1,7]),
        ("Paolo","Garcia","pgarcia","Finance","Finance Contractor",2,2,"Carla Mendoza","Active",1,"",1,[1,2,7]),
        ("Lea","Ramos","lramos","Operations","Operations Associate",7,6,"Victor Tan","Offboarded",0,"",0,[]),
    ]
    for first,last,username,department,title,ou_id,template_id,manager,status,enabled,expiry,must_reset,group_ids in users:
        cur = conn.execute(
            """
            INSERT INTO users(
                first_name,last_name,display_name,username,upn,department,title,ou_id,template_id,manager,
                status,enabled,expiry,must_reset_password,created_at,updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                first,last,f"{first} {last}",username,f"{username}@{DOMAIN}",department,title,ou_id,template_id,manager,
                status,enabled,expiry,must_reset,now,now,
            ),
        )
        user_id = int(cur.lastrowid)
        conn.executemany("INSERT INTO user_groups(user_id,group_id) VALUES(?,?)", [(user_id,gid) for gid in group_ids])

    conn.executemany(
        "INSERT INTO audit(at,actor,action,detail,user_id) VALUES(?,?,?,?,?)",
        [
            (now,"System","Directory initialized","Simulated directory data created.",None),
            (now,"Jim Camus","Group membership reviewed","jcamus group assignments verified.",3),
            (now,"Jim Camus","Account disabled","mtorres account disabled for simulated leave.",6),
            (now,"Jim Camus","User offboarded","lramos disabled, memberships removed, and moved to Disabled Users.",8),
        ],
    )


def log_audit(conn: sqlite3.Connection, action: str, detail: str, user_id: int | None = None, actor: str = "Jim Camus") -> None:
    conn.execute(
        "INSERT INTO audit(at,actor,action,detail,user_id) VALUES(?,?,?,?,?)",
        (utc_now(),actor,action,detail,user_id),
    )


def generate_username(conn: sqlite3.Connection, first: str, last: str, exclude_id: int | None = None) -> str:
    base = ((first.strip()[:1] + last.strip()).lower())
    base = "".join(ch for ch in base if ch.isalnum()) or "user"
    candidate = base
    number = 2
    while True:
        if exclude_id is None:
            row = conn.execute("SELECT 1 FROM users WHERE lower(username)=lower(?)", (candidate,)).fetchone()
        else:
            row = conn.execute("SELECT 1 FROM users WHERE lower(username)=lower(?) AND id<>?", (candidate,exclude_id)).fetchone()
        if not row:
            return candidate
        candidate = f"{base}{number}"
        number += 1


def replace_memberships(conn: sqlite3.Connection, user_id: int, group_ids: list[int]) -> None:
    valid = {r["id"] for r in conn.execute("SELECT id FROM groups").fetchall()}
    clean = sorted({int(g) for g in group_ids if int(g) in valid})
    conn.execute("DELETE FROM user_groups WHERE user_id=?", (user_id,))
    conn.executemany("INSERT INTO user_groups(user_id,group_id) VALUES(?,?)", [(user_id,g) for g in clean])


def user_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str,Any]:
    item = dict(row)
    item["enabled"] = bool(item["enabled"])
    item["must_reset_password"] = bool(item["must_reset_password"])
    item["groups"] = [r["group_id"] for r in conn.execute("SELECT group_id FROM user_groups WHERE user_id=? ORDER BY group_id",(row["id"],)).fetchall()]
    return item


def bootstrap() -> dict[str,Any]:
    with db() as conn:
        ous = [dict(r) for r in conn.execute("SELECT * FROM ous ORDER BY path").fetchall()]
        groups = [dict(r) for r in conn.execute("SELECT * FROM groups ORDER BY name").fetchall()]
        templates = []
        for r in conn.execute("SELECT * FROM templates ORDER BY name").fetchall():
            item = dict(r)
            item["groups"] = json.loads(item.pop("groups_json") or "[]")
            item["permissions"] = json.loads(item.pop("permissions_json") or "[]")
            templates.append(item)
        users = [user_dict(conn,r) for r in conn.execute("SELECT * FROM users ORDER BY last_name,first_name").fetchall()]
        audit = [dict(r) for r in conn.execute("SELECT * FROM audit ORDER BY at DESC,id DESC LIMIT 500").fetchall()]
    return {"generated_at":utc_now(),"domain":DOMAIN,"ous":ous,"groups":groups,"templates":templates,"users":users,"audit":audit}


class NewUser(BaseModel):
    first_name: str = Field(min_length=1,max_length=80)
    last_name: str = Field(min_length=1,max_length=80)
    department: str = Field(min_length=1,max_length=120)
    title: str = Field(min_length=1,max_length=120)
    ou_id: int
    template_id: int | None = None
    manager: str = Field(default="",max_length=120)
    expiry: str = Field(default="",max_length=20)


class UserUpdate(BaseModel):
    first_name: str
    last_name: str
    username: str
    upn: str
    department: str
    title: str
    ou_id: int
    template_id: int | None = None
    manager: str = ""
    expiry: str = ""
    groups: list[int] = Field(default_factory=list)


class AccountToggle(BaseModel):
    enabled: bool


class OffboardPayload(BaseModel):
    remove_groups: bool = True
    move_to_disabled_ou: bool = True


class BulkRow(BaseModel):
    first_name: str
    last_name: str
    department: str
    title: str
    ou_name: str = "Employees"
    template_name: str = ""


class BulkPayload(BaseModel):
    rows: list[BulkRow] = Field(min_length=1,max_length=100)


class OuCreate(BaseModel):
    name: str = Field(min_length=1,max_length=120)
    parent_id: int | None = None
    description: str = Field(default="",max_length=300)


class GroupCreate(BaseModel):
    name: str = Field(min_length=1,max_length=160)
    type: str = "Security"
    owner: str = ""
    risk: str = "Low"
    permission: str = ""


def create_user(conn: sqlite3.Connection, request: NewUser) -> dict[str,Any]:
    ou = conn.execute("SELECT * FROM ous WHERE id=?", (request.ou_id,)).fetchone()
    if not ou:
        raise ValueError("Selected OU was not found.")
    username = generate_username(conn,request.first_name,request.last_name)
    template = None
    groups: list[int] = []
    if request.template_id is not None:
        template = conn.execute("SELECT * FROM templates WHERE id=?", (request.template_id,)).fetchone()
        if not template:
            raise ValueError("Selected role template was not found.")
        groups = json.loads(template["groups_json"] or "[]")
    now = utc_now()
    cur = conn.execute(
        """
        INSERT INTO users(
            first_name,last_name,display_name,username,upn,department,title,ou_id,template_id,manager,
            status,enabled,expiry,must_reset_password,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,'Active',1,?,1,?,?)
        """,
        (
            request.first_name.strip(),request.last_name.strip(),f"{request.first_name.strip()} {request.last_name.strip()}",
            username,f"{username}@{DOMAIN}",request.department.strip(),request.title.strip(),request.ou_id,
            request.template_id,request.manager.strip(),request.expiry.strip(),now,now,
        ),
    )
    user_id = int(cur.lastrowid)
    replace_memberships(conn,user_id,groups)
    log_audit(conn,"User provisioned",f"{username} created"+(f" from {template['name']} template" if template else "")+".",user_id)
    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return user_dict(conn,row)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="AD User Provisioning Simulator API",version="1.0.0",lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8830","http://localhost:8830","https://sachibara.github.io"],
    allow_credentials=False,
    allow_methods=["GET","POST","PUT"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def api_health():
    return {"ok":True,"service":"AD User Provisioning Simulator","database":str(DB_PATH)}


@app.get("/api/bootstrap")
def api_bootstrap():
    return bootstrap()


@app.post("/api/users")
def api_create_user(request: NewUser):
    with db() as conn:
        try:
            user = create_user(conn,request)
        except ValueError as exc:
            raise HTTPException(status_code=400,detail=str(exc)) from exc
        conn.commit()
        return user


@app.put("/api/users/{user_id}")
def api_update_user(user_id: int, request: UserUpdate):
    with db() as conn:
        current = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not current:
            raise HTTPException(status_code=404,detail="User not found.")
        if not conn.execute("SELECT 1 FROM ous WHERE id=?", (request.ou_id,)).fetchone():
            raise HTTPException(status_code=400,detail="Selected OU was not found.")
        duplicate = conn.execute(
            "SELECT 1 FROM users WHERE (lower(username)=lower(?) OR lower(upn)=lower(?)) AND id<>?",
            (request.username.strip(),request.upn.strip(),user_id),
        ).fetchone()
        if duplicate:
            raise HTTPException(status_code=409,detail="Username or UPN already exists.")
        conn.execute(
            """
            UPDATE users SET first_name=?,last_name=?,display_name=?,username=?,upn=?,department=?,title=?,
            ou_id=?,template_id=?,manager=?,expiry=?,updated_at=? WHERE id=?
            """,
            (
                request.first_name.strip(),request.last_name.strip(),f"{request.first_name.strip()} {request.last_name.strip()}",
                request.username.strip(),request.upn.strip(),request.department.strip(),request.title.strip(),
                request.ou_id,request.template_id,request.manager.strip(),request.expiry.strip(),utc_now(),user_id,
            ),
        )
        replace_memberships(conn,user_id,request.groups)
        log_audit(conn,"Account updated",f"{request.username.strip()} identity and memberships updated.",user_id)
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return user_dict(conn,row)


@app.post("/api/users/{user_id}/password-reset")
def api_password_reset(user_id: int):
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404,detail="User not found.")
        conn.execute("UPDATE users SET must_reset_password=1,updated_at=? WHERE id=?", (utc_now(),user_id))
        log_audit(conn,"Password reset simulated",f"{row['username']} flagged to change temporary password at next sign-in.",user_id)
        conn.commit()
        return {"ok":True,"user_id":user_id,"must_reset_password":True}


@app.post("/api/users/{user_id}/account")
def api_account_toggle(user_id: int, request: AccountToggle):
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404,detail="User not found.")
        if row["status"] == "Offboarded" and request.enabled:
            raise HTTPException(status_code=400,detail="Offboarded accounts cannot be re-enabled in this simulator.")
        status = "Active" if request.enabled else "Disabled"
        conn.execute("UPDATE users SET enabled=?,status=?,updated_at=? WHERE id=?", (int(request.enabled),status,utc_now(),user_id))
        log_audit(conn,"Account enabled" if request.enabled else "Account disabled",f"{row['username']} account {status.lower()}.",user_id)
        conn.commit()
        return {"ok":True,"user_id":user_id,"enabled":request.enabled,"status":status}


@app.post("/api/users/{user_id}/offboard")
def api_offboard(user_id: int, request: OffboardPayload):
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404,detail="User not found.")
        if request.remove_groups:
            conn.execute("DELETE FROM user_groups WHERE user_id=?", (user_id,))
        ou_id = row["ou_id"]
        if request.move_to_disabled_ou:
            disabled = conn.execute("SELECT id FROM ous WHERE name='Disabled Users' LIMIT 1").fetchone()
            if disabled:
                ou_id = disabled["id"]
        conn.execute("UPDATE users SET enabled=0,status='Offboarded',ou_id=?,updated_at=? WHERE id=?", (ou_id,utc_now(),user_id))
        log_audit(conn,"User offboarded",f"{row['username']} disabled"+(", memberships removed" if request.remove_groups else "")+(", moved to Disabled Users" if request.move_to_disabled_ou else "")+".",user_id)
        conn.commit()
        return {"ok":True,"user_id":user_id,"status":"Offboarded"}


@app.post("/api/users/bulk")
def api_bulk(request: BulkPayload):
    created = []
    with db() as conn:
        for item in request.rows:
            ou = conn.execute("SELECT id FROM ous WHERE lower(name)=lower(?) ORDER BY id LIMIT 1",(item.ou_name.strip(),)).fetchone()
            if not ou:
                ou = conn.execute("SELECT id FROM ous WHERE name='Employees' LIMIT 1").fetchone()
            template_id = None
            if item.template_name.strip():
                template = conn.execute("SELECT id FROM templates WHERE lower(name)=lower(?)",(item.template_name.strip(),)).fetchone()
                template_id = template["id"] if template else None
            payload = NewUser(
                first_name=item.first_name,last_name=item.last_name,department=item.department,title=item.title,
                ou_id=ou["id"],template_id=template_id,manager="",expiry=""
            )
            created.append(create_user(conn,payload))
        log_audit(conn,"Bulk provisioning completed",f"{len(created)} simulated users provisioned.")
        conn.commit()
    return {"created":len(created),"users":created}


@app.post("/api/ous")
def api_create_ou(request: OuCreate):
    with db() as conn:
        parent = None
        if request.parent_id is not None:
            parent = conn.execute("SELECT * FROM ous WHERE id=?", (request.parent_id,)).fetchone()
            if not parent:
                raise HTTPException(status_code=400,detail="Parent OU not found.")
        if conn.execute("SELECT 1 FROM ous WHERE lower(name)=lower(?) AND parent_id IS ?",(request.name.strip(),request.parent_id)).fetchone():
            raise HTTPException(status_code=409,detail="OU already exists under this parent.")
        path = f"OU={request.name.strip()}," + (parent["path"] if parent else "DC=corp,DC=local")
        cur = conn.execute("INSERT INTO ous(name,parent_id,path,description) VALUES(?,?,?,?)",(request.name.strip(),request.parent_id,path,request.description.strip()))
        log_audit(conn,"OU created",f"{request.name.strip()} created in directory.")
        conn.commit()
        return dict(conn.execute("SELECT * FROM ous WHERE id=?",(int(cur.lastrowid),)).fetchone())


@app.post("/api/groups")
def api_create_group(request: GroupCreate):
    if request.type not in {"Security","Distribution"} or request.risk not in {"Low","Medium","High"}:
        raise HTTPException(status_code=400,detail="Invalid group type or risk.")
    with db() as conn:
        if conn.execute("SELECT 1 FROM groups WHERE lower(name)=lower(?)",(request.name.strip(),)).fetchone():
            raise HTTPException(status_code=409,detail="Group already exists.")
        cur = conn.execute("INSERT INTO groups(name,type,owner,risk,permission) VALUES(?,?,?,?,?)",(request.name.strip(),request.type,request.owner.strip(),request.risk,request.permission.strip()))
        log_audit(conn,"Group created",f"{request.name.strip()} access group created.")
        conn.commit()
        return dict(conn.execute("SELECT * FROM groups WHERE id=?",(int(cur.lastrowid),)).fetchone())


@app.get("/")
def ui():
    return FileResponse(ROOT/"index.html")


@app.get("/styles.css")
def styles():
    return FileResponse(ROOT/"styles.css",media_type="text/css")


@app.get("/demo-data.js")
def demo():
    return FileResponse(ROOT/"demo-data.js",media_type="application/javascript")


@app.get("/app.js")
def script():
    return FileResponse(ROOT/"app.js",media_type="application/javascript")


def main() -> None:
    import uvicorn
    print("AD User Provisioning Simulator: http://127.0.0.1:8830")
    uvicorn.run(app,host="127.0.0.1",port=8830,log_level="info")


if __name__=="__main__":
    main()
