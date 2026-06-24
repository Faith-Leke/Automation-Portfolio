# AI-Powered Opportunity Discovery & Application Engine

A fully autonomous, multi-workflow system that discovers relevant opportunities from across the web, evaluates each one against a configurable candidate profile using AI, generates tailored application documents, and delivers print-ready PDFs — all on a scheduled, hands-free basis. The system is built across three interconnected workflows that each own a distinct phase of the pipeline.

---

## System Architecture

This system is composed of three workflows that operate as a single coordinated engine:

| Workflow | Role |
|---|---|
| **Engine (Main Orchestrator)** | Schedules runs, manages API key selection, scrapes opportunity sources, deduplicates results, and hands validated opportunities to the Processor |
| **Job Processor (Sub-Workflow)** | Receives each opportunity, scrapes the full listing, runs AI classification and fit scoring, generates tailored documents, converts them to PDF, and logs every outcome |
| **API Resetter (Maintenance)** | Runs nightly to reset daily API usage counters in the database, ensuring the key rotation system starts each day with a clean slate |

---

### 1. Features

**Discovery & Ingestion**
- **Scheduled Multi-Run Discovery:** Triggers automatically at configurable times across the day, pulling opportunity sources from a managed database table and executing targeted search queries for each.
- **Recency Filtering:** Automatically discards listings older than a configurable threshold, ensuring only fresh, recently posted opportunities enter the pipeline.
- **Result Normalization:** Parses raw search results into a clean, structured data format — extracting titles, company names, URLs, posted dates, and source identifiers.
- **Deduplication Engine:** Cross-references every discovered opportunity against a database of previously processed listings using unique URL-based IDs, eliminating all duplicates before any AI processing begins.

**AI Classification & Fit Scoring**
- **Deep Content Extraction:** Uses Jina AI to scrape the full text of each opportunity listing and convert it to structured markdown for AI analysis.
- **AI Role Classifier:** Passes the full listing to an LLM with a detailed multi-criteria evaluation rubric — assessing role type, location eligibility, required skill overlap, and disqualifying signals — to determine if the opportunity is a genuine fit.
- **Fit Score Engine:** For listings that pass classification, a second AI agent evaluates the opportunity against a master candidate profile across four weighted dimensions: tech stack coverage, project complexity match, domain expertise, and requirements coverage — producing a numerical fit score and match level.
- **Tiered Quality Routing:** Routes opportunities into configurable tiers (e.g. High Fit, Mid Fit, No Show) based on the fit score, ensuring downstream document generation only fires for worthwhile opportunities.

**Document Generation**
- **AI Resume Architect:** For every qualifying opportunity, an LLM rewrites the candidate's profile summary using the employer's exact vocabulary, re-ranks the available experience blocks by relevance, and identifies the most applicable skills — producing a fully tailored application strategy.
- **AI Cover Letter Generator:** Generates a bespoke, context-aware cover letter for each opportunity based on the application strategy, the job description, and the candidate's master profile.
- **Dynamic HTML Resume Builder:** Assembles a fully formatted, print-ready HTML resume by injecting the AI-generated strategy into a structured template, with experience blocks ordered and labelled for the specific role.
- **PDF Conversion & Download:** Converts the generated HTML resume to a PDF via a conversion API, downloads the final file, and stores it — ready for immediate submission.
- **PDF Generation Load Balancer:** Distributes PDF conversion requests across multiple parallel paths to prevent API throttling and maintain throughput at scale.

**API & Quota Management**
- **Smart API Key Selection:** Before every run, the system fetches all available API keys from the database, filters out any that have reached their daily usage limit, and randomly selects an available key — halting the workflow with a clear error if all keys are exhausted.
- **Live Usage Tracking:** Increments the usage counter for the selected API key in the database after every run, maintaining an accurate real-time count of consumption against the daily limit.
- **Nightly Quota Reset:** A dedicated maintenance workflow runs on a nightly schedule to reset all API usage counters back to zero and sends a confirmation report to the operator.

**Observability & Telegram Integration**
- **Granular Status Logging:** Every stage of processing — from job analysis through resume generation to PDF download — writes a status record to the database, giving the operator a full audit trail of every opportunity processed.
- **Telegram Manual Trigger:** Supports a secondary trigger where a job listing URL can be submitted directly via Telegram for on-demand, single-item processing outside of the scheduled runs.
- **Real-Time Fit Alerts:** Sends an instant Telegram notification when a high-fit opportunity is identified, including the job title, company, fit score, and a direct link to the listing.
- **Fault-Tolerant Error Handling:** Every critical node is configured to retry on failure and log error states to the database rather than crashing the pipeline, ensuring maximum throughput even when individual listings fail.

---

### 2. Tech Stack

- **Orchestration:** n8n (multi-workflow architecture with sub-workflow execution)
- **Database:** Baserow
- **AI / LLM:** Google Gemini (via Generative Language API)
- **Search:** Serper API (Google Search)
- **Web Scraping:** Jina AI (`r.jina.ai`)
- **PDF Generation:** ConvertAPI (HTML to PDF)
- **Notifications:** Telegram Bot API
- **Custom Logic:** JavaScript (deduplication, result normalization, date parsing, recency filtering, API key selection, response parsing, HTML resume assembly)

---

### 3. External Dependencies

- **Serper API Keys:** Required by the main orchestrator to execute search queries against configurable opportunity sources. Multiple keys are stored in a dedicated Baserow table and managed by the key rotation system.
- **Google Gemini API Keys:** Required by the Job Processor for all AI classification, fit scoring, resume strategy generation, and cover letter generation. Keys are stored in Baserow with daily usage counters managed by the rotation and reset system.
- **Jina AI Endpoint:** The `r.jina.ai` endpoint must be active to extract full listing content from discovered URLs.
- **ConvertAPI Account:** An active ConvertAPI key is required to convert the generated HTML resume into a downloadable PDF file.
- **Telegram Bot:** A configured Telegram Bot token and chat ID are required for real-time fit alerts and the manual URL submission trigger.
- **Baserow Workspace:** Three configured Baserow tables are required:
  - An **Opportunity Sources** table containing the search queries or source URLs to run, with a status field to track processing state.
  - A **Processed Opportunities** table to store all discovered and analysed listings with full status audit trail fields.
  - An **API Key Vault** table storing all Serper and Gemini API keys with daily usage counter fields.
- **Master Candidate Profile & Resume Vault:** A configured data source containing the candidate's master CV text, project list with structured IDs, and experience blocks — used by the AI Resume Architect to generate tailored documents.

---

### 4. Business & Technical Impact

- **Eliminates Manual Discovery:** Replaces hours of daily searching, reading, and filtering listings by hand — the system autonomously discovers, scrapes, and evaluates opportunities on a schedule with zero operator input required.
- **Applies Only Where It Counts:** The multi-stage AI classification and fit scoring pipeline ensures document generation only fires for genuinely relevant opportunities, preventing wasted effort on poor matches.
- **Produces Submission-Ready Documents Autonomously:** Every qualifying opportunity exits the pipeline with a tailored resume PDF and cover letter — ready to submit — without the operator writing a single word.
- **Built for Sustained, High-Volume Operation:** The API key rotation system, nightly quota reset, and load-balanced PDF generation ensure the pipeline runs continuously at scale across multiple daily runs without hitting third-party rate limits.
- **Fully Auditable:** Granular status logging at every processing stage means the operator always has a clear, queryable record of what was found, what was processed, what was generated, and what failed.
- **Fully Adaptable:** The opportunity sources, AI classification criteria, candidate profile, fit score thresholds, and document templates are all configurable — making this system deployable for any discovery, evaluation, and document generation use case beyond its initial implementation context.
