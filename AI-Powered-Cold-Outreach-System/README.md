# AI-Enabled Cold Email Outreach & Activation System

A fully automated, AI-powered outreach engine that personalizes and delivers cold emails at scale — pulling pre-qualified leads from your database, crafting context-aware messaging, and maintaining clean pipeline status without any manual intervention.

---

### 1. Features

- **Scheduled Daily Activation:** Triggers automatically on a configurable schedule, pulling a defined batch of leads marked as ready for outreach from the database each run.
- **AI-Powered Name Cleaning:** Uses an LLM to extract and normalize a clean, colloquial brand name from raw company name strings — removing legal suffixes, locations, and industry descriptors — so every email opens with a natural, human-sounding greeting.
- **Multi-Template Email Routing:** A triage node dynamically routes each lead to the appropriate email variant based on configurable logic, enabling multi-angle outreach campaigns from a single workflow.
- **Fully Personalized HTML Emails:** Sends professionally designed, responsive HTML emails with dynamic fields injected per recipient — including personalized subject lines and in-body brand name references.
- **Human-Safe Send Intervals:** Introduces a randomized wait between 3 and 9 minutes between each email send to mimic natural human sending behaviour and protect domain reputation.
- **Automatic CRM Status Update:** Immediately updates each lead's pipeline status in the database to "Contacted" after the email is successfully delivered — keeping the CRM accurate with zero manual input.
- **API Key Rotation:** Rotates across a configurable array of API keys on every execution to distribute LLM request volume and prevent rate-limiting at scale.
- **Operator Success Notification:** Sends a branded HTML summary email to the operator at the end of each batch, confirming total leads processed and run status.
- **Single-Lead Test Mode:** Includes a manual trigger branch for firing a single test email to a sandbox address before activating full batch runs.

---

### 2. Tech Stack

- **Orchestration:** n8n
- **Database:** Baserow
- **AI / LLM:** Groq (Llama-3.3-70b-versatile)
- **Email Delivery:** Gmail (OAuth2) / n8n Send Email node
- **Custom Logic:** JavaScript (API key rotation, AI response parsing, dynamic payload mapping)

---

### 3. External Dependencies

- **Baserow Workspace:** A configured Baserow database and table containing your lead records, with a status field used to filter leads marked as ready for outreach and update them to contacted post-send.
- **Groq API Keys:** An array of active Groq API keys configured in the Key Rotator node to power the AI name-cleaning step at volume.
- **Gmail OAuth2 Credentials:** A connected Gmail account authenticated via OAuth2 to serve as the outreach sending address.
- **Email Template Configuration:** The HTML email body and subject line must be customized to reflect your offer, value proposition, and sender identity before activation.

---

### 4. Business & Technical Impact

- **Eliminates Manual Outreach:** Replaces the time-consuming process of manually researching, writing, and sending individual cold emails — the system handles the full send cycle autonomously on a daily schedule.
- **Protects Domain Reputation at Scale:** The randomized send delay between emails mimics human behaviour, significantly reducing the risk of spam flagging and preserving deliverability across high-volume campaigns.
- **Keeps the Pipeline Accurate:** Automatic post-send status updates ensure your CRM reflects the true state of every lead without requiring an operator to log a single touch.
- **Fully Adaptable:** The email templates, lead filters, triage logic, and AI classification criteria are all configurable — making this system deployable for any outreach campaign, industry vertical, or offer type.
