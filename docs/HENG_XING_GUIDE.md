# Heng Xing Order Management — Product Guide, FAQs & Policy

Everything about the Heng Xing Order Management application in one document: what it does, answers to common questions, and the rules for using it.

## Contents

1. [Product Information](#part-1--product-information)
2. [Frequently Asked Questions](#part-2--frequently-asked-questions)
3. [Usage & Data Policy](#part-3--usage--data-policy)

---

## Part 1 — Product Information

A web application for **Heng Xing Mould Pvt. Ltd.** that tracks every mould order from the moment it is booked to the moment it is dispatched — customers and their specifications, order booking, production planning, shop-floor progress, customer complaints, and approvals — in one place.

---

### Who it is for

The app is organised around four roles. Each person sees only the sections their role needs.

| Role | What they do in the app | Sections they see |
|---|---|---|
| **Admin** | Oversees everything: the dashboard, all modules, users, roles and master data. Approves or rejects delete requests and is notified when orders go on hold. | Everything |
| **Marketing** | Manages customer companies, books and edits orders, logs complaints and problem types. | Companies, Orders, Complaints, Problems |
| **Planning** | Reviews new orders, approves or holds them, corrects sizes and assigns the production steps for each order. | Planning |
| **Production** | Supervisors tick off each production step, piece by piece, as the work is done. | Production (Supervisor Dashboard) |

---

### Modules

#### Dashboard (Admin)
An at-a-glance overview of the business:
- **Key figures** — total orders, New / RC / RR orders, overdue deliveries, orders on hold, companies, users and roles. Each card links to the matching filtered list.
- **Order activity** — orders received per day over the last 14 days, with this week compared to last week.
- **Order mix** — the share of New, RC and RR orders.
- **Recent orders** — the latest orders received, with overdue deliveries flagged.
- **Needs attention** — overdue deliveries and orders on hold, one click away.

Figures refresh automatically every 30 seconds while the page is open.

#### Companies
The customer master. For each company the app keeps:
- Name and address
- **Directors** and **contractors** (name and contact number)
- **Presses** used by the customer
- **Manufacturing specifications** — one row per size, with green tile thickness, upper punch, upper master number, lower punch, lower-punch master number and cavity, plus any additional master numbers for specific punch types.

These specifications auto-fill when an order is booked for that company and size.

#### Orders
Booking and tracking orders.
- Every order gets an automatic number in the format **`HX/YY/MM/NNN`** (e.g. `HX/26/10/002`). Numbers are never reused, even if an order is later deleted.
- Each order records the company, size, punch type, order type, quantity (pieces), expected delivery date, master number, the person who booked it, and remarks.
- **Order types:** **New** (a new mould), **RC** and **RR** (repeat orders).
- **Punch types:** U - ISO, U - N ISO, U - PLAIN, U - RUSTIC, L - ISO, L - N ISO, L - PLAIN, L - RUSTIC.
- Search, filter by type, sort by order number, company, size or delivery date, and switch between **All Orders** and **Hold Orders**.
- One status follows the order through its life: **Pending → Planned → in progress (%) → Completed**, or **On Hold**.
- Track any order to see exactly which production steps are done for each piece.

#### Planning
Where every new order is reviewed before production starts.
- **Planning status:** **Review** (just received) → **Approved** or **On Hold** → **Planned** once the planning details are saved.
- Planners can correct the size and master number, and record milling size, facing thickness, taper details, punch border and punch depth.
- They choose which production steps the order needs, and enter the punch numbers for repeat (RC/RR) orders.
- A whole order, or individual pieces within it, can be put on hold and released again.

#### Production — Supervisor Dashboard
Tracks shop-floor progress **per punch number** (each physical piece moves through production on its own).

Standard production steps:

1. Milling RA
2. FACE
3. Hole – Loading
4. Welding
5. Grinding
6. Final R.A
7. Radius
8. **Heater** *(repeat orders — RC and RR — only)*
9. Resin
10. Dispatch

Each tick is time-stamped automatically, and supervisors can add a remark against a step for a specific piece. The order's overall progress percentage updates as steps are completed.

#### Complaints
Customer-raised issues, linked to a company and a problem type.
- Every complaint gets an automatic number in the format **`CMP/YY/MM/NNN`**.
- **Status:** **Active** (newly raised) → **Pending** (being worked on) → **Completed**.
- Attach up to **10 pictures** per complaint (JPG, PNG, GIF or WebP, up to 5 MB each).

#### Delete Requests
A safety net for deleting orders and complaints. Marketing cannot delete records directly — they raise a **delete request** with a reason, and an Admin **approves** (the record is deleted) or **rejects** it, optionally with a note. Requests can be filtered by Pending, Approved, Rejected or All.

#### Settings (master data)
- **Users** — team members and their sign-in access
- **Roles** — permission groups assigned to users
- **Sizes** — the mould sizes available on orders and specifications
- **Problems** — the problem types used when logging complaints

#### Notifications
The bell in the header shows, in real time (checked every 30 seconds):
- **Admin:** delete requests waiting for review, and orders that have been put on hold.
- **Everyone who raised a delete request:** the decision on it (approved or rejected).

Desktop notifications can be enabled from the bell.

#### My Profile
Every user can update their name, email address and password, and see the role assigned to them.

---

### Key features at a glance

- Role-based access — each person sees only what their job needs
- Automatic, never-reused order and complaint numbers
- Customer specifications auto-filled into new orders
- Piece-level production tracking with time-stamped steps
- Whole-order and item-level holds
- Approval workflow for deletions
- Live updates and in-app / desktop notifications
- Works on desktop, tablet and mobile
- Fast single-page experience — moving between sections is instant

---

### Technical overview

| | |
|---|---|
| **Frontend** | React 19 + TypeScript, built with Vite; single-page app with client-side routing |
| **Backend** | Laravel REST API |
| **Access control** | Role-based permissions (Admin, Marketing, Planning, Production) |
| **Sign-in** | Email and password; short-lived access token (1 hour) renewed automatically with a refresh token (30 days) |
| **Supported browsers** | Current versions of Chrome, Edge, Firefox and Safari |

---

## Part 2 — Frequently Asked Questions

### Getting started

**How do I sign in?**
Open the app and enter the email address and password your Admin gave you. You'll land on the section for your role: Admins on the Dashboard, Marketing on Companies, Planning on Planning, Production on the Supervisor Dashboard.

**I forgot my password. What should I do?**
Ask an Admin to set a new password for you from **Settings → Users**. Once you're signed in, you can change it yourself under **My Profile**.

**How do I change my name, email or password?**
Click your picture in the top-right corner and open **My Profile**. To change your password, enter your current password and the new one, then click **Save Changes**.

**Why can't I see some menu items?**
The menu only shows the sections your role is allowed to use. If you need access to something else, ask an Admin to change your role.

**How long do I stay signed in?**
You stay signed in on the same browser for up to 30 days of use; the app renews your session automatically in the background. Click **Sign out** from your profile menu when you're using a shared computer.

**Can I use the app on my phone?**
Yes. The app works on phones and tablets. Tap the menu button (☰) at the top left to open the side menu.

---

### Companies

**How do I add a new customer?**
Go to **Companies** and click the **+** button. Fill in the company name and address, add at least one director, contractor and press, then add the manufacturing specifications for each size the customer orders.

**Why do I need to enter manufacturing specifications?**
When an order is booked for a company and size, the app fills in that size's specifications (thickness, punches, master numbers, cavity) automatically, so they don't have to be typed again — and can't be typed wrongly.

**What are "Other Master Numbers"?**
Some customers use a different master number for a particular punch type. Add it under the specification, and orders of that punch type will offer the matching master number.

---

### Orders

**How do I book an order?**
Go to **Orders** and click **+**. Choose the company, then the size (only that company's sizes are offered), the punch type and the order type. Check the auto-filled size details, enter the quantity and expected delivery date, pick the master number, and click **Create Order**.

**What's the difference between New, RC and RR orders?**
**New** is a brand-new mould. **RC** and **RR** are repeat orders. Repeat orders include an extra **Heater** step in production, and their punch numbers are entered during planning.

**How is the order number created?**
Automatically, in the format `HX/YY/MM/NNN` — year, month, then a running number for that month (for example `HX/26/10/002`). Numbers are never reused.

**What do the order statuses mean?**

| Status | Meaning |
|---|---|
| **Pending** | Booked, not yet planned |
| **Planned** | Planning is complete; ready for production |
| **25%, 60% …** | In production — the share of production steps completed |
| **Completed** | Every step is done for every piece |
| **On Hold** | Planning has paused the order |
| **2/8 hold** | Some pieces of the order (here 2 of 8) are on hold |

**How do I see exactly where an order is in production?**
Open the order's view and use **Track**, or click its progress percentage. You'll see each piece and which steps are done, with dates.

**Can I edit an order after booking it?**
Yes, Marketing and Admin can edit orders from the **Orders** list using the edit button.

**How do I delete an order?**
Admins can delete directly. Marketing users click delete to raise a **delete request** with a reason; an Admin then approves or rejects it. You'll get a notification with the decision.

**What does "Overdue" mean?**
The expected delivery date has passed. Overdue orders are highlighted in red and counted on the Dashboard.

---

### Planning

**What happens to a new order in Planning?**
It arrives with the status **Review**. The planner checks it and either **approves** it or puts it **on hold**. Approved orders are then planned: the planner corrects sizes if needed, enters the planning fields, chooses the production steps and (for RC/RR orders) enters the punch numbers. Saving marks the order **Planned**.

**Can I hold just part of an order?**
Yes. In the planning window you can put individual pieces on hold and release them later, or hold the whole order. Admins are notified whenever something is put on hold.

---

### Production

**How do supervisors record progress?**
Open **Production**, find the order, and tick each step as it's completed for each punch number. The time is recorded automatically.

**Can I add a note about a problem on one piece?**
Yes. Add a remark against the step for that specific punch number.

**Why does the order show a percentage?**
It's the share of all planned steps, across all pieces, that have been ticked. When it reaches 100% the order is **Completed**.

---

### Complaints

**How do I log a customer complaint?**
Go to **Complaints**, click **+**, choose the company and problem type, give it a title and details, and attach pictures if you have them.

**How many pictures can I attach?**
Up to 10 per complaint, in JPG, PNG, GIF or WebP format, up to 5 MB each.

**What do complaint statuses mean?**
**Active** — newly raised. **Pending** — someone is working on it. **Completed** — resolved.

**The problem type I need isn't listed.**
Marketing and Admin can add new problem types under **Problems** (Admins find it in **Settings**).

---

### Notifications

**What does the bell show?**
Admins see delete requests waiting for review and orders that were put on hold. Anyone who raised a delete request sees the decision. The bell checks for new items every 30 seconds.

**Can I get desktop notifications?**
Yes. Open the bell and allow notifications when prompted. If you blocked them earlier, re-enable them in your browser's site settings.

---

### Troubleshooting

**The page shows old information.**
Lists refresh automatically every 30 seconds. You can also refresh the browser page at any time.

**I was signed out unexpectedly.**
Your session may have expired or been ended from another tab. Sign in again. If it keeps happening, tell an Admin.

**A form won't save.**
Check for red messages under the fields. Every field marked as required must be filled before saving.

**Who do I contact for help?**
Contact your system Admin.

---

## Part 3 — Usage & Data Policy

> **Draft for review.** This policy describes how the Heng Xing Order Management application is meant to be used and how it handles data, based on how the system actually works. Management should review it, and adjust it to company policy and any legal requirements, before it is published or signed off.

**Applies to:** all employees and contractors of Heng Xing Mould Pvt. Ltd. who are given an account on the Heng Xing Order Management application.

---

### 1. Purpose

This policy sets out who may use the application, what each role may do, how records are created, changed and deleted, and how user accounts and data are protected.

### 2. Accounts and sign-in

1. Accounts are created only by an **Admin**. Users cannot register themselves.
2. Each account belongs to **one named person**. Accounts and passwords must not be shared.
3. Passwords must be **at least 8 characters**. Users should choose a password not used for any other service, and change it from **My Profile** if they suspect it is known to anyone else.
4. Sessions renew automatically for up to **30 days**. On shared or public computers, users must **sign out** when they finish.
5. When a person leaves the company or no longer needs access, an Admin must **remove their account** promptly.

### 3. Roles and access

Access is granted by **role**, never by individual permission. Each user is assigned the role that matches their job:

| Role | Allowed |
|---|---|
| **Admin** | Full access to all sections, users, roles and master data; approves or rejects delete requests. |
| **Marketing** | View, create and edit companies, orders, complaints and problem types. Cannot delete directly — may only *request* deletion of orders and complaints. |
| **Planning** | The Planning section only: review, approve or hold orders, and plan them for production. |
| **Production** | The Production section only: record completed production steps and remarks. |

Users must not attempt to reach sections outside their role. The application blocks such access, and attempts may be reviewed.

### 4. Data accuracy

1. Users are responsible for the accuracy of the information they enter.
2. **Customer specifications** (sizes, punches, master numbers, cavity) must match the customer's confirmed requirements, because they are copied automatically into new orders.
3. **Expected delivery dates** must be realistic and updated if they change.
4. **Production steps** must be ticked only when the work on that piece is actually finished. Tick times are recorded automatically by the system and cannot be back-dated.

### 5. Order lifecycle and holds

1. Every new order goes through **Planning review** before production starts.
2. A planner may put a whole order, or individual pieces, **on hold**. Admins are notified automatically. Holds should be released, or the order updated, as soon as the reason is resolved.
3. Order numbers (`HX/YY/MM/NNN`) and complaint numbers (`CMP/YY/MM/NNN`) are issued by the system. They are **never reused**, and must be used when referring to a record.

### 6. Deleting records

1. Only Admins may delete records directly.
2. Other users must raise a **delete request** stating a clear reason. Only one open request per record is allowed at a time.
3. An Admin reviews each request and either **approves** it (the record is deleted) or **rejects** it, with a note where helpful. The requester is notified of the decision.
4. Deleted orders and complaints are **removed from the application** but retained in the system's records, so their numbers are never reissued and the history can be investigated if needed.
5. Records must never be deleted to hide mistakes. Correct them by editing instead.

### 7. Complaints and attachments

1. Complaints must be logged against the correct company and problem type.
2. Attachments must be **pictures relevant to the complaint only** (JPG, PNG, GIF or WebP, up to 5 MB each, at most 10 per complaint).
3. Pictures must not include personal information unrelated to the complaint.

### 8. Confidentiality

1. Customer details, specifications, master numbers, order volumes and complaint records are **confidential business information**.
2. Information from the application may be shared only with people who need it for their work, and must not be copied to personal devices, personal email or outside services without management approval.
3. Screenshots or exports shared outside the company require management approval.

### 9. Notifications

The application may show in-app and (if the user allows it) desktop notifications about delete requests and orders on hold. Users should act on notifications relevant to their role promptly.

### 10. Reporting problems

Any suspected misuse, lost password, wrong data that cannot be corrected, or system fault should be reported to an Admin straight away.

### 11. Changes to this policy

This policy may be updated as the application or business processes change. The current version is the one kept with the application's documentation.

---

*Last updated: 6 October 2026*

