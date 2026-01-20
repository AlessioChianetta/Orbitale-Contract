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

## User Preferences

Preferred communication style: Simple, everyday language.