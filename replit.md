# Turbo Contract - Advanced Contract Management System

## Overview

Turbo Contract is a comprehensive web application for creating, managing, and digitally signing advanced contract templates. The system allows administrators to create sophisticated contract templates with dynamic content blocks, while sellers can generate customized contracts and send them to clients for secure digital signature with OTP verification.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful API with role-based access control

### Database Architecture
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: Structured with users, contract templates, contracts, audit logs, and OTP codes

## Key Components

### User Management
- Role-based authentication (Admin/Seller)
- Secure password hashing with scrypt
- Session-based authentication with persistent storage
- Protected routes with role-based access control

### Template System
- Rich text template editor for admins
- Support for simple placeholder variables (`{{variable}}`)
- Advanced dynamic blocks for repeatable content sections
- Template versioning and activation status

### Contract Generation
- Dynamic form generation based on template structure
- Client data collection with validation
- PDF generation using Puppeteer
- Unique contract codes for secure client access

### Digital Signature Workflow
- Secure client contract viewing without authentication
- Two-factor authentication via SMS OTP
- Complete audit trail with IP tracking and timestamps
- Tamper-proof PDF generation with embedded audit logs

### External Services Integration
- Email service for contract delivery (Nodemailer)
- SMS service integration for OTP delivery
- PDF generation with professional formatting

## Data Flow

1. **Template Creation**: Admin creates contract templates with dynamic content blocks
2. **Contract Generation**: Seller selects template and fills client-specific data
3. **Contract Delivery**: System generates PDF and sends secure link via email
4. **Client Interaction**: Client accesses contract via unique code, reviews content
5. **Signature Process**: Client initiates signature, receives OTP via SMS
6. **Contract Completion**: OTP verification completes signature, audit trail finalized

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless database connection
- **drizzle-orm**: Type-safe ORM for database operations
- **express**: Web application framework
- **passport**: Authentication middleware
- **nodemailer**: Email sending service
- **puppeteer**: PDF generation from HTML

### Frontend Dependencies
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI primitives
- **react-hook-form**: Form state management
- **zod**: Runtime type validation
- **tailwindcss**: Utility-first CSS framework

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking and compilation
- **tsx**: TypeScript execution for development

## Deployment Strategy

### Build Process
- Frontend: Vite builds optimized React application to `dist/public`
- Backend: esbuild bundles server code to `dist/index.js`
- Database: Drizzle migrations applied via `db:push` command

### Environment Configuration
- Database connection via `DATABASE_URL`
- Session security via `SESSION_SECRET`
- Email service configuration via SMTP credentials
- Base URL configuration for contract links

### Production Considerations
- Session store uses PostgreSQL for scalability
- Static files served efficiently in production
- Error handling with proper HTTP status codes
- Security headers and CORS configuration

## Changelog
- June 27, 2025. Initial setup
- June 27, 2025. Implemented professional contract layout with company header, structured client data sections, integrated payment plans and bonus fields, GDPR compliance checkboxes, and professional signature areas for both PDF generation and web client view
- June 28, 2025. Implemented always-active auto-renewal system with contract validity period display. Removed optional auto-renewal checkbox from forms and made all contracts automatically renewable. Added contract validity period section showing from-month to to-month validity before auto-renewal clause in both digital view and PDF generation.
- June 28, 2025. Completed comprehensive mobile optimization for client-view page. Implemented responsive design with mobile-first approach: responsive header layout, card-based client data display for mobile (replacing table layout), touch-friendly form controls with larger buttons and inputs, optimized OTP input with larger touch targets, and improved checkbox and consent areas with better spacing for mobile interaction.
- June 29, 2025. Implemented advanced partnership percentage model for selected restaurants. Added option to create contracts based on percentage of total revenue instead of fixed pricing. Includes comprehensive partnership clauses defining total revenue, payment calculation methods, transparency requirements, and penalties. Both contract creation form and client view support displaying partnership percentage instead of fixed price.
- July 10, 2025. Integrated Twilio Verify for professional SMS OTP delivery. Implemented hybrid OTP system that uses Twilio Verify for phone numbers when available (more cost-effective and professional) with automatic fallback to email for clients without phone numbers. Enhanced security with dual verification methods and improved user experience with proper SMS delivery confirmation. Added editable phone number functionality on client contract view for flexible OTP delivery.
- July 10, 2025. Implemented real-time contract editing for all contract statuses (sent/viewed/signed), enabling immediate modifications upon client requests. Fixed critical timezone issues by converting all audit trail timestamps from UTC to Italian time (CET). Resolved duplicate "viewed" audit log entries by preventing repeated logs from same IP within 5 minutes. Corrected signature metadata display showing accurate phone numbers and single signature count instead of incorrect "3 signatures".
- January 20, 2026. Fixed client contract view bug where custom content sections (customContent, paymentText, predefinedBonuses) were not displaying. The getContractByCode function now includes the full template object in the API response, enabling the client view page to render all custom template sections properly.
- February 20, 2026. Fixed critical contract signing bug: added missing companyId parameters in routes.ts for getCompanySettings() and getContract() calls in signing endpoints. Fixed mutation call in client-view.tsx to pass correct {otpCode, consents, signatures} payload.
- February 20, 2026. Integrated Google Gemini AI (gemini-2.5-flash model) via @google/genai package. Created server/services/provider-factory.ts with three AI functions: chatContratto() for contract consultation chat, guidedContractWizard() for step-by-step contract creation, generateContractFromAI() for full contract generation from summary. Added 4 AI API routes in server/routes.ts (all protected with requireAuth).
- February 20, 2026. Complete refactoring of template-editor.tsx from dialog modal to full-screen tabbed interface with 4 tabs (Info, Content, Bonus & Payment, AI Assistant). The AI tab contains two sub-tabs: Guided Wizard (ai-contract-wizard.tsx) for step-by-step contract creation, and Chat Consultation (ai-contract-chat.tsx) for free-form AI assistance. Added HtmlEditorWithPreview component with toolbar (bold, italic, list, paragraph) and live preview mode. AI-generated content flows via form.setValue() callbacks into template fields.
- February 20, 2026. Complete Premium SaaS 2026 redesign of admin-dashboard.tsx: glassmorphism header, gradient CTAs, premium KPI cards with large numbers and trend indicators, modern list replacing table with search/filter/sort controls, hover micro-interactions, consistent color palette (#4F46E5 primary, #7C3AED accent).
- February 20, 2026. Complete Premium SaaS 2026 redesign of template-editor.tsx: AI Assistant moved to always-visible LEFT SIDEBAR (380px fixed), main editor reduced to 3 tabs (Info, Contenuto, Bonus & Pagamento). Premium pill-style tabs, gradient action buttons, copyable variable pills, soft informative cards, sticky footer. Added thinking mode to AI (thinkingConfig with budgets: low=4096, medium=8192) and extractTextFromResponse() for thinking model output.

### AI Integration Architecture
- **AI Service**: server/services/provider-factory.ts using Google AI Studio (@google/genai) with API_KEY from env
- **Model**: gemini-3-flash-preview for all AI operations with thinking mode enabled (low/medium budgets)
- **Chat Component**: client/src/components/ai-contract-chat.tsx - message-based conversation with copy/insert functionality
- **Wizard Component**: client/src/components/ai-contract-wizard.tsx - guided Q&A with progress tracking, legal references, summary generation
- **AI Routes**: POST /api/ai/chat, /api/ai/wizard/start, /api/ai/wizard/answer, /api/ai/wizard/generate
- **Data Flow**: AI content → form.setValue() → template save → contract generation → client view → PDF

## User Preferences

Preferred communication style: Simple, everyday language.