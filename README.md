> **Consolidated module:** This project is preserved as source/history, but its public product experience is now part of **[OpsFusion](https://sachibara.github.io/HelpDesk-Pro/)**. The consolidation reduces duplicate portfolio projects and connects this capability to a shared enterprise data/workflow model.

# AD User Provisioning Simulator

A portfolio-grade identity administration and user-lifecycle simulator for IT Help Desk, Systems Administration, IT Operations, and Infrastructure roles.


## Public App

**Live app:** https://sachibara.github.io/AD-User-Provisioning-Simulator/

## Modes
- **Browser Workspace Mode** — persistent browser directory with realistic users, OUs, groups, role templates, lifecycle actions, and audit history.
- **Live Simulator Mode** — local FastAPI + SQLite backend that persists the simulated directory.

## Features
- User creation and onboarding
- Username and UPN generation
- Organizational Units (OUs)
- Security / distribution groups
- Group membership management
- Role templates
- Account enable / disable
- Password-reset simulation
- Account expiration
- Offboarding workflow
- Bulk provisioning
- Permission summaries
- Search / filters
- CSV export
- Audit history
- REST API + SQLite

## Run local simulator
~~~powershell
python -m pip install -r backend/requirements.txt
python backend/directory_api.py
~~~

Open:

~~~text
http://127.0.0.1:8830
~~~

## Safety
This is a simulator. It does not connect to or modify a real Active Directory domain, Entra ID tenant, Windows Server, or enterprise identity provider.

## Developer
**Jim Rodmark Camus**  
BSIT — Network Technology  
GitHub: [@Sachibara](https://github.com/Sachibara)
