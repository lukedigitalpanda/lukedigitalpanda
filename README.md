# MSP Service Desk

**Professional IT Service Management Platform for Managed Service Providers**

A comprehensive service desk application built for MSPs to manage client IT support, assets, change requests, and knowledge — with AI-powered ticket classification and Microsoft 365 email integration.

---

## Features

- **Ticket Management** -- Full lifecycle ticket tracking with statuses, priorities, SLA deadlines, categories, and assignment workflows
- **Email-to-Ticket via Microsoft 365** -- Automatic ingestion of support emails from a shared mailbox using Microsoft Graph API, with bi-directional email sync
- **AI-Powered Classification** -- OpenAI-driven automatic categorisation of incoming tickets based on subject and description
- **AI Suggestions** -- Intelligent resolution suggestions drawn from knowledge base articles and historical ticket data
- **AI Summaries** -- Automatic summarisation of ticket threads and activities for quick technician review
- **Asset Management** -- Track workstations, laptops, servers, network devices, printers, software licences, and more per client
- **Change Request Management** -- ITIL-aligned change workflows with draft, review, approval, implementation, and rollback stages
- **Client & SLA Management** -- Manage multiple clients with contract types, SLA tiers (Gold/Silver/Bronze), contacts, and service history
- **Reporting & Analytics** -- Dashboard with ticket volume, SLA compliance, time tracking, and workload distribution metrics
- **Knowledge Base** -- Internal and public-facing articles organised by category and tags for self-service and technician reference
- **Time Tracking** -- Per-ticket billable and non-billable time entries for accurate client invoicing

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Authentication** | NextAuth.js |
| **UI Components** | Radix UI, Tailwind CSS, shadcn/ui |
| **AI** | OpenAI GPT API |
| **Email Integration** | Microsoft Graph API (MSAL) |
| **Charts** | Recharts |
| **Forms** | React Hook Form + Zod |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Microsoft 365 tenant (for email integration)
- OpenAI API key (for AI features)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd lukedigitalpanda
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the required values (see [Environment Variables](#environment-variables) below).

4. **Set up the database**

   ```bash
   npx prisma migrate dev
   ```

5. **Seed the database with sample data**

   ```bash
   npm run db:seed
   ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`.

---

## Project Structure

```
lukedigitalpanda/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seed data
├── src/
│   ├── app/
│   │   ├── (auth)/            # Authentication pages (login)
│   │   ├── (dashboard)/       # Dashboard, tickets, clients, change requests
│   │   └── api/
│   │       ├── ai/            # AI classification, suggestions, summarisation
│   │       ├── assets/        # Asset CRUD endpoints
│   │       ├── auth/          # NextAuth configuration
│   │       ├── change-requests/ # Change request endpoints
│   │       ├── clients/       # Client management endpoints
│   │       ├── dashboard/     # Dashboard aggregation endpoint
│   │       ├── email/         # Email send and sync endpoints
│   │       ├── knowledge/     # Knowledge base endpoints
│   │       ├── reports/       # Reporting endpoints
│   │       └── tickets/       # Ticket CRUD, comments, time entries
│   ├── components/
│   │   └── ui/                # Reusable UI components (shadcn/ui)
│   ├── lib/
│   │   ├── ai/                # OpenAI client, classifier, suggestions, summariser, sentiment
│   │   ├── jobs/              # Background jobs (email sync)
│   │   ├── microsoft/         # Microsoft Graph client, email service, email-to-ticket
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── utils.ts           # Utility functions
│   └── types/                 # TypeScript type definitions
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Application URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret for NextAuth session encryption |
| `AZURE_AD_CLIENT_ID` | Microsoft Entra (Azure AD) application client ID |
| `AZURE_AD_CLIENT_SECRET` | Microsoft Entra application client secret |
| `AZURE_AD_TENANT_ID` | Microsoft Entra tenant ID |
| `MICROSOFT_GRAPH_MAILBOX` | Shared mailbox for email-to-ticket (e.g. `support@digitalpanda.co.uk`) |
| `OPENAI_API_KEY` | OpenAI API key for AI features |

---

## Modules

### Tickets

Core ticketing system with support for multiple statuses (Open, In Progress, Waiting on Client, Waiting on Vendor, Resolved, Closed), priority levels, SLA tracking, assignment, comments (internal and client-visible), file attachments, and activity logging.

### Email Integration

Connects to a Microsoft 365 shared mailbox via Microsoft Graph API. Incoming emails are automatically converted into tickets. Outbound replies sent from the service desk are delivered as emails and threaded correctly using conversation IDs.

### AI Engine

Leverages OpenAI to automatically classify tickets by category, generate resolution suggestions based on the knowledge base, summarise long ticket threads, and analyse sentiment of incoming communications.

### Asset Management

Full IT asset inventory per client, supporting workstations, laptops, servers, network devices, printers, mobile devices, software licences, and peripherals. Tracks manufacturer, model, serial number, network details, warranty, and licence expiry.

### Change Requests

ITIL-aligned change management with support for Standard, Normal, and Emergency change types. Includes implementation plans, rollback plans, risk assessment, scheduling, approval workflows, and comment threads.

### Knowledge Base

Internal article repository organised by category and tags. Articles can be marked as public for client self-service or kept internal for technician reference. Integrated with the AI suggestion engine.

### Reporting

Dashboard and reporting endpoints providing ticket volume trends, SLA compliance rates, technician workload distribution, billable time summaries, and client-level analytics.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database (no migration) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run email:sync` | Run email sync job manually |

---

## License

Private -- All rights reserved.
