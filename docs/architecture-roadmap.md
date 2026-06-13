# ConnectRole Architecture Roadmap

This document explains how ConnectRole currently handles data, what is missing, and a practical path to add a real database plus cloud infrastructure that strengthens the project for internships and new-grad roles.

## 1. Current architecture

Today, ConnectRole is a Next.js App Router application with three main layers:

1. Client UI
   - `components/setup-screen.tsx`
   - `components/interview-screen.tsx`
   - `components/results-screen.tsx`
2. Server API routes
   - `app/api/setup/parse/route.ts`
   - `app/api/interview/opening/route.ts`
   - `app/api/interview/turn/route.ts`
   - `app/api/interview/summary/route.ts`
   - `app/api/tts/route.ts`
3. Business logic and integrations
   - `lib/setup-intelligence.ts`
   - `lib/interview-brain.ts`
   - `lib/interview-engine.ts`
   - `lib/llm/*`
   - `lib/session.ts`

## 2. How data is handled right now

### Setup flow

1. The user uploads a resume and pastes a job post in the browser.
2. The browser extracts PDF text locally.
3. `POST /api/setup/parse` sends raw resume text and job text to the server.
4. `lib/setup-intelligence.ts` combines heuristic parsing with an LLM call to structure the data.
5. The parsed result is saved in browser `sessionStorage` through `lib/session.ts`.

### Interview flow

1. The interview page loads setup state from `sessionStorage`.
2. Each answer is sent to `POST /api/interview/turn`.
3. `lib/interview-brain.ts` asks the LLM for evaluation, follow-up questions, and coaching tips.
4. The browser stores the growing interview session in `sessionStorage`.

### Results flow

1. The results page reads setup + interview state from `sessionStorage`.
2. `lib/interview-engine.ts` computes scores and the final report.
3. `POST /api/interview/summary` generates a summary with the LLM.
4. The final report is also stored only in `sessionStorage`.

### External services already in use

- LLM provider through `lib/llm/provider.ts`
- Google Cloud Text-to-Speech through `app/api/tts/route.ts`
- Vercel analytics through `@vercel/analytics`

## 3. Current limitations

This project works well as a prototype, but from an infrastructure point of view it has four major gaps:

1. No durable persistence
   - If the tab closes, session data can disappear.
2. No authentication
   - There is no user identity, account, or saved interview history.
3. No server-owned source of truth
   - The browser owns the session, which makes multi-device use and analytics difficult.
4. No file/object storage
   - Resume files are parsed, but the project does not retain original uploads.

## 4. Best next step for this project

For this app, the strongest improvement is:

- PostgreSQL for relational data
- Object storage for resume PDFs
- Authentication for users
- A managed cloud deployment that can run Next.js API routes

If your goal is both better engineering and better job-market signal, the most resume-friendly path is:

1. Add PostgreSQL
2. Add auth
3. Add object storage
4. Add Docker
5. Deploy on AWS or Azure
6. Add simple observability and CI/CD

## 5. Recommended target architecture

### Application layer

- Next.js frontend + API routes
- Server routes become the source of truth for interview state

### Data layer

- PostgreSQL for:
  - users
  - resumes
  - job postings
  - interview sessions
  - interview turns
  - generated reports

### File storage

- AWS S3 or Azure Blob Storage for uploaded resume PDFs

### Auth

- NextAuth/Auth.js or Clerk
- If you want stronger cloud alignment:
  - AWS: Cognito
  - Azure: Microsoft Entra External ID or Azure AD B2C equivalent path

### Observability

- Request logs
- Error tracking
- Basic metrics for interviews created, completed, and average score

## 6. Suggested database model

Use PostgreSQL as the main database. A starter schema is in `db/schema.sql`.

The main idea:

- `users`
  - Who owns the account
- `resumes`
  - Parsed resume metadata + file location
- `job_postings`
  - Parsed job details
- `interview_sessions`
  - One interview attempt
- `interview_turns`
  - Question/answer pairs and feedback
- `final_reports`
  - The generated summary of an interview

## 7. What should move from the browser to the server

Right now `lib/session.ts` stores:

- setup session
- interview session
- final report

That is fine for a prototype, but production should work like this:

1. Browser sends setup payload
2. Server parses and saves:
   - resume
   - job posting
   - interview session
3. Server returns `interviewSessionId`
4. Browser only stores:
   - auth token/cookie
   - current session id
   - light UI state
5. Every new turn updates the database
6. Results page loads from the database, not `sessionStorage`

## 8. Clean implementation plan

### Phase 1: database foundation

- Add PostgreSQL
- Add an ORM or query layer
  - Best choice here: Prisma
- Create migrations
- Add repository helpers for sessions, turns, and reports

### Phase 2: auth + persistence

- Add auth
- Create `users` table
- Replace anonymous browser-only sessions with user-owned interview sessions

### Phase 3: file storage

- Save uploaded resume PDFs to object storage
- Save extracted text and structured fields in PostgreSQL
- Keep only file URLs/keys in the database

### Phase 4: server-owned interview lifecycle

- On interview start, create a row in `interview_sessions`
- On each answer, insert into `interview_turns`
- On completion, generate and persist `final_reports`

### Phase 5: production polish

- Dockerize the app
- Add CI checks
- Add logs and error tracking
- Add rate limiting to AI routes

## 9. AWS recommendation

If you want one cloud stack that looks strong on a resume and matches many job postings, AWS is the best single choice for this project.

Recommended AWS mapping:

- Frontend + Next.js server: AWS Amplify Hosting
- Database: Amazon RDS for PostgreSQL
- File storage: Amazon S3
- Auth: Amazon Cognito
- Secrets: AWS Systems Manager Parameter Store or AWS Secrets Manager
- Monitoring: CloudWatch
- Optional containers later: ECS or App Runner

Why AWS is a strong choice here:

- It matches the app well
- It teaches services companies actually use
- It gives you a clear full-stack deployment story

## 10. Azure recommendation

Azure is also a solid choice, especially if you want to target companies that are heavy on Microsoft tooling.

Recommended Azure mapping:

- Frontend + Next.js hosting: Azure Static Web Apps or Azure App Service
- Database: Azure Database for PostgreSQL
- File storage: Azure Blob Storage
- Auth: Microsoft Entra
- Secrets: Azure Key Vault
- Monitoring: Azure Monitor / Application Insights

Azure is especially good if you want to say:

- built and deployed on Azure
- integrated app auth and monitoring
- used Blob Storage and managed PostgreSQL

## 11. Which one should you pick

If you only do one, pick AWS.

Reason:

- AWS is still the safest general-purpose cloud skill to advertise
- The service mapping for this app is straightforward
- It pairs well with Docker, PostgreSQL, CI/CD, and API-driven systems design

If you want a second cloud later, learn Azure concepts after the AWS version is working.

## 12. Best technologies to add for job-market value

For your specific project, the highest-value additions are:

1. PostgreSQL
2. Prisma
3. Docker
4. AWS deployment
5. Auth
6. S3-style object storage
7. Basic CI/CD
8. Logging/monitoring

If you add only one database, choose PostgreSQL.

If you add only one cloud, choose AWS.

## 13. What I would build next in this repo

In order:

1. Add Prisma + PostgreSQL
2. Save parsed resume/job data in the database
3. Persist interview sessions and turns server-side
4. Add user login
5. Upload PDFs to S3
6. Deploy to AWS Amplify + RDS
7. Add Docker and GitHub Actions

## 14. Resume-worthy project description after these changes

Once implemented, this project can be described like this:

"Built and deployed an AI mock interview platform with Next.js, TypeScript, PostgreSQL, and AWS. Implemented persistent interview session storage, resume upload handling with object storage, LLM-powered feedback APIs, and production-style cloud deployment with managed database, authentication, and monitoring."

## 15. Optional stretch goals

- Semantic search over prior interviews using embeddings
- Admin analytics dashboard
- Role-based access control
- Background jobs for report generation
- Caching hot interview context with Redis
- Event-driven processing for uploads

## 16. Practical rule for this project

Use the database for structured state.

Use object storage for files.

Use the server as the source of truth.

Use the browser only for temporary UI state.
